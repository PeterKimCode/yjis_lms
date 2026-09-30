#!/usr/bin/env bash
# deploy-lms: deploy GitHub main, or explicitly deploy the server working tree.
set -Eeuo pipefail
umask 077

APP_DIR="${LMS_APP_DIR:-/srv/docker/sites/lms}"
APP_NAME="${LMS_APP_NAME:-lms-app}"
COMPOSE_FILE="${LMS_COMPOSE_FILE:-docker-compose.gmk.yml}"
HEALTH_URL="${LMS_HEALTH_URL:-http://127.0.0.1:3004/login}"
PUBLIC_URL="${LMS_PUBLIC_URL:-https://lms.mygtcc.com/login}"
mode="remote"
phase="preflight"
rollback_image=""

usage() {
  cat <<'HELP'
Usage: deploy-lms [--local | --check | --help]

  (no option)  Fetch GitHub origin/main and fast-forward a clean main branch.
               Never reset, discard, stash, or overwrite server changes.
  --local      Build the current server working tree without fetching GitHub.
               This does not copy files from your PC or push commits.
  --check      Show source/deployment readiness without deploying or fetching.
  --help       Show this help.

GitHub deployment requires changes to be committed and pushed from your PC first.
Server-only Dockerfile, deploy.sh, docker-compose.gmk.yml, .dockerignore and
prisma.config.ts.bak are allowed as untracked deployment files.
HELP
}

die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

on_error() {
  local status=$?
  printf '\nDeployment FAILED during %s (exit %s).\n' "$phase" "$status" >&2
  if [[ -n "$rollback_image" ]]; then
    printf 'Previous app image retained: %s\n' "$rollback_image" >&2
  fi
  printf 'Database migrations are not automatically reversed. No success is reported.\n' >&2
  exit "$status"
}
trap on_error ERR

[[ $# -le 1 ]] || { usage; exit 2; }
case "${1:-}" in
  "") ;;
  --local) mode="local" ;;
  --check) mode="check" ;;
  --help|-h) usage; exit 0 ;;
  *) usage; exit 2 ;;
esac

for tool in git docker curl flock; do
  command -v "$tool" >/dev/null || die "Required command is missing: $tool"
done
cd "$APP_DIR"
[[ -f "$COMPOSE_FILE" ]] || die "Compose file not found: $COMPOSE_FILE"
git rev-parse --is-inside-work-tree >/dev/null

# All invocations, including --check, share the same lock for this checkout.
lock_path="$(git rev-parse --git-path deploy-lms.lock)"
exec 9>"$lock_path"
flock -n 9 || die "Another deploy-lms process is running. Try again when it finishes."

compose=(docker compose -f "$COMPOSE_FILE")
"${compose[@]}" config --quiet

branch="$(git branch --show-current)"
revision="$(git rev-parse --short HEAD)"
tracked_changes="$(git status --porcelain --untracked-files=no)"
untracked_changes="$(git ls-files --others --exclude-standard -- . \
  ':(exclude)Dockerfile' ':(exclude)deploy.sh' \
  ':(exclude)docker-compose.gmk.yml' ':(exclude).dockerignore' \
  ':(exclude)prisma.config.ts.bak')"
printf 'LMS source: %s\nBranch: %s\nCommit: %s\n' "$APP_DIR" "$branch" "$revision"
if [[ -n "$tracked_changes$untracked_changes" ]]; then
  printf '\nServer source changes:\n%s\n%s\n' "$tracked_changes" "$untracked_changes"
fi

if [[ "$mode" == "check" ]]; then
  if [[ "$branch" != "main" || -n "$tracked_changes$untracked_changes" ]]; then
    printf '\nGitHub deployment is blocked. Use --local for this server working tree,\nor reconcile it with committed/pushed main first. No files were discarded.\n'
    exit 1
  fi
  printf '\nCheckout is clean on main. Remote updates and build are not checked.\n'
  exit 0
fi

if [[ "$mode" == "remote" ]]; then
  [[ "$branch" == "main" ]] || die "Expected branch main. Use --local to deploy the current checkout."
  [[ -z "$tracked_changes$untracked_changes" ]] || die "Server changes must be preserved. Use deploy-lms --local to deploy them, or reconcile them with GitHub first."
  phase="GitHub synchronization"
  git fetch origin main
  [[ "$(git rev-list --count origin/main..HEAD)" == "0" ]] || die "Server has commits not on origin/main. Reconcile them first or use --local."
  # git merge refuses untracked-file collisions and never discards local changes.
  git merge --ff-only origin/main
else
  printf '\nLOCAL MODE: deploying current SERVER files; GitHub and your PC are not synchronized.\n'
fi

phase="saving the previous app image"
if old_image="$(docker inspect --format '{{.Image}}' "$APP_NAME" 2>/dev/null)"; then
  rollback_image="${APP_NAME}:before-deploy-$(date -u +%Y%m%dT%H%M%SZ)"
  docker image tag "$old_image" "$rollback_image"
  printf 'Previous image retained: %s\n' "$rollback_image"
fi

phase="building the app image"
"${compose[@]}" build app

phase="applying database migrations"
"${compose[@]}" run --rm --no-deps app npx prisma migrate deploy

phase="restarting the app"
"${compose[@]}" up -d --no-deps app

check_url() {
  local url="$1" attempt
  for ((attempt=1; attempt<=12; attempt++)); do
    if curl --fail --silent --show-error --location --max-time 10 \
      --output /dev/null "$url"; then
      return 0
    fi
    if ((attempt < 12)); then sleep 2; fi
  done
  return 1
}

phase="local health check"
check_url "$HEALTH_URL"
phase="public health check"
check_url "$PUBLIC_URL"

printf '\nLMS deployment completed.\nMode: %s\nCommit: %s\nURL: https://lms.mygtcc.com\n' \
  "$mode" "$(git rev-parse --short HEAD)"
if [[ "$mode" == "local" && -n "$tracked_changes$untracked_changes" ]]; then
  printf 'This release includes uncommitted server changes; the commit alone does not identify it.\n'
fi
