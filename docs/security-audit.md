# LMS Security and Permission Audit

Last updated: 2026-06-05

## Scope

This audit focuses on server-side authorization and data visibility for:

- Auth and session handling
- Admin academic setup and scoped RBAC
- Instructor, student, and parent dashboards
- Lessons, attendance, assignments, quizzes, grades, documents, policies
- Boards, comments, image downloads
- Text-only messenger
- In-app notifications

## Controls Verified or Hardened

### Authentication

- Credentials login uses rate limiting by email.
- Login rate limiting uses Redis when `REDIS_URL` is configured, with in-memory fallback for local/single-container installs.
- Sessions explicitly expire after 8 hours.
- Admin accounts are excluded from the temporary in-memory lockout so emergency access is not accidentally blocked.
- Login now distinguishes inactive accounts, locked accounts, missing passwords, and unavailable organizations from a wrong password where NextAuth exposes the credential error code.
- Public registration is not exposed.
- Inactive users are excluded when resolving the current authenticated user.

### Admin Scope

- Admin access is resolved from active role assignments.
- `SUPER_ADMIN` can access all organizations and campuses.
- Organization-wide admins can access only their organization.
- Campus-scoped admins are restricted to their assigned campus.
- Admin user listing and user editing are filtered by scope.
- Updating a user now checks both:
  - permission for the requested new organization/campus scope
  - permission to edit the existing user record

### Audit Logs

- `AuditLog` stores security-sensitive server-side events.
- Coverage includes organization/user changes, class instructor assignment,
  student enrollment, attendance updates, board moderation, file view/download,
  file upload creation, policy changes, final grade publish/finalize, and
  document PDF downloads.
- Admins can review scoped audit events at `/admin/audit-logs`.
- Audit logs can be filtered, opened in a detail view, and exported as CSV for lightweight operational review.
- Audit writes are best-effort and do not block the user-facing operation if logging fails.

### Conversations

- Conversation lists and details load only participant conversations.
- Conversation access no longer allows non-participant class members to view a direct conversation just because they share a class section.
- Sending messages requires current user participation in the conversation.
- Student-to-student direct messaging remains disabled.

### Files

- File downloads require an authenticated user.
- File downloads route through `/api/files/[fileId]/download`.
- Raw MinIO/S3 URLs are not exposed.
- File access checks cover:
  - uploader
  - permitted avatar/profile viewers
  - organization logo viewers
  - assignment submission viewers
  - board/post/comment viewers
  - class-section file viewers
- Inline rendering is restricted to image MIME types.
- File responses include `X-Content-Type-Options: nosniff`.
- Successful file views/downloads are recorded in `AuditLog`.

### Notifications

- Notification list and actions are scoped to the current `userId`.
- Notification action URLs are normalized to internal relative URLs only.
- Mark read/unread/archive actions use `userId` filters.

## Automated Checks

Run:

```bash
npm run test:security
```

Current coverage:

- Super admin global scope
- Organization admin organization-only scope
- School admin campus-only scope
- Academic staff campus-only scope
- Non-admin roles denied from admin scopes

Run:

```bash
npm run audit:actions
```

This reports remaining Server Action raw throw candidates that should be converted to form-friendly errors over time.

See also:

- `docs/operations-and-security.md`

## Remaining Hardening Backlog

- Keep Redis enabled in multi-container production deployments so login lockouts are shared across app instances.
- Add CSRF-aware stateful wrappers for all sensitive Server Actions that are not already protected by framework form semantics.
- Continue converting remaining raw-throw Server Actions to `useActionState` responses for friendlier errors.
- Add integration tests for:
  - file download permissions
  - assignment submission visibility
  - board image visibility
  - parent/student data boundaries
  - direct conversation participant-only access
- Add field-level before/after diffs for user and policy changes when schools need stricter change review.
- Prune old audit logs only after database backup is verified:
  `npm run audit:prune -- --days=365 --dry-run`
- Add security headers at the deployment/proxy level:
  - `Content-Security-Policy`
  - `Referrer-Policy`
  - `Permissions-Policy`
  - `Strict-Transport-Security` in HTTPS production
- Keep application CSP in report-only mode until external translation, video, and media flows are verified.
- Add malware scanning before accepting production file uploads.
