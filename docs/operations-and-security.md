# LMS Operations and Security Checklist

Last updated: 2026-06-05

This document is for the person running the LMS on a real server.

## Login Protection

- Non-admin accounts are rate limited by email.
- Default rule: 5 failed attempts within 5 minutes locks login for 15 minutes.
- Admin accounts are not locked by this in-memory login limiter, so the school does not lose emergency access.
- If `REDIS_URL` is configured, the rate limiter uses Redis so limits work across multiple app containers.
- If `REDIS_URL` is not configured, the app falls back to an in-memory limiter for local/single-container deployments.
- If a non-admin account is locked, the login page should show a lock message instead of a generic password error.

Recommended production setup:

- Set `REDIS_URL`.
- Add reverse-proxy rate limiting for `/api/auth/callback/credentials`.

## Session Expiration

- Sessions use JWT strategy.
- Session max age: 8 hours.
- JWT max age: 8 hours.
- Session update age: 1 hour.

Operational note:

- Users should expect to log in again after a school day or after long inactivity.

## Database Connection Pool

The app uses Prisma with the PostgreSQL adapter and a bounded pool.

Environment variable:

```bash
DATABASE_POOL_MAX=5
```

If the server logs show:

```text
Too many database connections opened
P2037
```

Check:

- How many `lms-app` containers are running.
- Whether background worker containers are also connecting to the same database.
- PostgreSQL `max_connections`.
- `DATABASE_POOL_MAX` per container.

Rule of thumb:

```text
total possible app DB connections =
  number of app containers * DATABASE_POOL_MAX
  + number of worker containers * DATABASE_POOL_MAX
  + admin tools / migrations
```

Keep that total safely below PostgreSQL `max_connections`.

## Database Backups

Create a manual PostgreSQL backup:

```bash
npm run db:backup
```

Custom output path:

```bash
npm run db:backup -- --output=/srv/backups/lms-$(date +%F).dump
```

Requirements:

- `DATABASE_URL` must be set.
- `pg_dump` must be installed in the environment running the command.

Restore example:

```bash
pg_restore --clean --if-exists --no-owner --dbname "$DATABASE_URL" /srv/backups/lms-2026-06-05.dump
```

Recommended production schedule:

- daily database backup,
- retain at least 7 daily backups,
- keep a separate off-server copy,
- test restore monthly.

Example cron entry on the host:

```cron
15 2 * * * cd /srv/docker/sites/lms && docker exec lms-app npm run db:backup -- --output=/app/backups/lms-$(date +\%F).dump
```

If backups are written inside the container, mount `/app/backups` to a host directory.

## Admin Recovery

Use this when a live admin cannot access the admin dashboard because a role, organization, or campus was changed.

Inside the running container:

```bash
docker exec -it lms-app npm run admin:repair-access -- --email super.admin@demo.local --role SUPER_ADMIN
```

For a school admin:

```bash
docker exec -it lms-app npm run admin:repair-access -- --email school.admin@demo.local --role SCHOOL_ADMIN
```

The repair script can:

- reactivate the user,
- ensure the user has an active organization,
- create or repair the role assignment,
- assign the default organization if needed.

## Default Organization Safety

If a user's organization was deleted or disabled, login should not be reported as a password problem.

Expected behavior:

- inactive account: show account inactive message,
- disabled/missing organization: show organization unavailable or contact admin message,
- missing password: show password not configured message,
- wrong password: show invalid email or password.

## Server Action Error Handling

Run:

```bash
npm run audit:actions
```

This prints Server Action files that still throw raw runtime errors.

Priority for future cleanup:

1. Admin actions that create, edit, or delete records.
2. Instructor actions for attendance, lessons, assignments, quizzes.
3. Board and message moderation actions.

Preferred pattern:

- Validate with Zod `safeParse`.
- Return `{ ok: false, message: "Friendly message" }`.
- Show the result with the shared action feedback/toast UI.
- Avoid raw runtime error pages for normal user mistakes.

## Audit Logs

The app now has an `AuditLog` table for security-sensitive activity.

Current initial coverage:

- organization create/update,
- organization delete and user fallback reassignment.
- user create/update,
- class instructor assignment/removal,
- student enrollment/removal,
- attendance record changes,
- board create/update/deactivate/delete,
- board post/comment create/update/delete,
- board image removal,
- file view/download,
- final grade publish/finalize,
- report card/transcript PDF download.

Admin review page:

```text
/admin/audit-logs
```

Useful audit log tools:

```bash
# Preview how many old logs would be removed.
npm run audit:prune -- --days=365 --dry-run

# Delete logs older than 365 days. Run only after backup is working.
npm run audit:prune -- --days=365
```

What this means:

- The log answers "who changed what and when?"
- It is not a replacement for database backups.
- It is useful when checking grade release, transcript downloads, user changes, and class enrollment changes.
- It is useful for answering parent/admin questions such as "who changed attendance?" or "who downloaded this transcript?"
- Detail pages show the event metadata, and CSV export supports lightweight review outside the LMS.
- Login security events are logged for admin login success/failure and repeated failed login lockouts.
- Policy saves include before/after snapshots so admins can review what changed.

Recommended next coverage:

- field-level before/after diffs for user profile and enrollment changes,
- shipping audit logs to an external log store for tamper-resistant retention.

## Permission Regression Test

Run:

```bash
npm run test:security
```

This currently checks:

- super admin global access,
- organization admin organization-only access,
- school admin campus-only access,
- academic staff campus-only access,
- non-admin rejection.

Recommended next tests:

- student cannot access another student's grades,
- parent cannot access unlinked student data,
- instructor cannot manage unrelated class sections,
- board image downloads require board access,
- direct conversations require participant access.

## Deployment Header Recommendations

Set these at the proxy or hosting layer when HTTPS is enabled:

```text
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

The app also sends `Content-Security-Policy-Report-Only` from `next.config.ts`.
This means the browser can report potential CSP violations without blocking the
page yet. Keep it in report-only mode until Google Translate, YouTube/video
lessons, and uploaded media have been tested in production.
