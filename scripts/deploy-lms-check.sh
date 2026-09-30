#!/usr/bin/env bash
# Isolated regression checks: real temporary Git repositories, mocked Docker/curl.
set -Eeuo pipefail
candidate="$(realpath "${1:-$(dirname "$0")/deploy-lms.sh}")"
test_dir="$(mktemp -d /tmp/lms-deploy-test.XXXXXX)"
real_git="$(command -v git)"
mkdir "$test_dir/bin"
log="$test_dir/commands.log"
out="$test_dir/output.log"
export MOCK_LOG="$log" REAL_GIT="$real_git" MOCK_FAILURE=""

cat > "$test_dir/bin/docker" <<'MOCK'
#!/usr/bin/env bash
printf 'docker %s\n' "$*" >> "$MOCK_LOG"
case "$*" in
  inspect*) printf 'sha256:test-previous-image\n' ;;
  *' build app') [[ "$MOCK_FAILURE" != "build" ]] ;;
  *' migrate deploy') [[ "$MOCK_FAILURE" != "migration" ]] ;;
  *' up -d --no-deps app') [[ "$MOCK_FAILURE" != "restart" ]] ;;
  *) exit 0 ;;
esac
MOCK
cat > "$test_dir/bin/curl" <<'MOCK'
#!/usr/bin/env bash
printf 'curl %s\n' "$*" >> "$MOCK_LOG"
[[ "$MOCK_FAILURE" != "health" ]] || exit 22
if [[ "$MOCK_FAILURE" == "public" && "$*" == *https://* ]]; then exit 22; fi
MOCK
cat > "$test_dir/bin/git" <<'MOCK'
#!/usr/bin/env bash
printf 'git %s\n' "$*" >> "$MOCK_LOG"
exec "$REAL_GIT" "$@"
MOCK
cat > "$test_dir/bin/sleep" <<'MOCK'
#!/usr/bin/env bash
exit 0
MOCK
chmod +x "$test_dir/bin/"*

git init -q --bare "$test_dir/remote.git"
git init -q -b main "$test_dir/producer"
git -C "$test_dir/producer" config user.name 'Deployment test'
git -C "$test_dir/producer" config user.email 'deployment-test@example.invalid'
printf 'original\n' > "$test_dir/producer/README.md"
git -C "$test_dir/producer" add README.md
git -C "$test_dir/producer" commit -qm initial
git -C "$test_dir/producer" remote add origin "$test_dir/remote.git"
git -C "$test_dir/producer" push -q origin main
git clone -q --branch main "$test_dir/remote.git" "$test_dir/app"
printf 'services: {}\n' > "$test_dir/app/docker-compose.gmk.yml"
printf 'server config\n' > "$test_dir/app/Dockerfile"

run() {
  : > "$log"
  LMS_APP_DIR="$test_dir/app" PATH="$test_dir/bin:$PATH" bash "$candidate" "$@" > "$out" 2>&1
}
fail() { cat "$out"; printf 'FAIL: %s\n' "$*" >&2; exit 1; }
expect_failure() {
  if run "$@"; then fail "Unexpected success: $*"; fi
  if grep -q 'LMS deployment completed' "$out"; then fail 'False success message'; fi
}

run --check || fail 'Clean readiness check'
! grep -Eq 'git fetch|docker .*build|docker .*up -d|migrate deploy' "$log" || fail 'Check changed deployment'
printf 'PASS: check is read-only and allows server-only deployment files\n'

printf 'new upstream\n' >> "$test_dir/producer/README.md"
git -C "$test_dir/producer" commit -qam update
git -C "$test_dir/producer" push -q origin main
run || fail 'Clean fast-forward deployment'
grep -q 'new upstream' "$test_dir/app/README.md" || fail 'Upstream not synchronized'
grep -q 'docker .*migrate deploy' "$log" || fail 'Migrations not run'
grep -q 'docker .*up -d --no-deps app' "$log" || fail 'App not restarted'
! grep -q 'git reset' "$log" || fail 'Destructive reset'
printf 'PASS: clean checkout fast-forwards and deploys only app\n'

printf 'server edit\n' >> "$test_dir/app/README.md"
expect_failure
grep -q 'server edit' "$test_dir/app/README.md" || fail 'Server changes lost'
! grep -Eq 'git fetch|docker .*build|migrate deploy' "$log" || fail 'Dirty checkout deployed'
printf 'PASS: uncommitted changes block remote deployment without losing edits\n'

run --local || fail 'Local working-tree deployment'
! grep -Eq 'git fetch|git merge|git reset' "$log" || fail 'Local mode synchronized remote'
grep -q 'server edit' "$test_dir/app/README.md" || fail 'Local edit lost'
grep -q 'docker image tag' "$log" || fail 'Previous image not retained'
printf 'PASS: explicit local mode preserves source and previous image\n'

for phase in build migration restart health public; do
  export MOCK_FAILURE="$phase"
  expect_failure --local
  if [[ "$phase" == "build" || "$phase" == "migration" ]]; then
    ! grep -q 'docker .*up -d' "$log" || fail 'Restart after failed build/migration'
  fi
  grep -q 'Deployment FAILED during' "$out" || fail 'Failure phase missing'
  printf 'PASS: %s failure is reported without false success\n' "$phase"
done
export MOCK_FAILURE=""

exec 8>"$test_dir/app/.git/deploy-lms.lock"
flock -n 8
expect_failure --local
! grep -q '^docker ' "$log" || fail 'Concurrent deploy executed Docker'
flock -u 8
exec 8>&-
printf 'PASS: concurrent deployment is blocked\n'
printf 'All deployment checks passed. Test artifacts: %s\n' "$test_dir"
