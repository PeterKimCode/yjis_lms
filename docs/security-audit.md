# LMS Security and Permission Audit

Last updated: 2026-05-24

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
- Sessions explicitly expire after 8 hours.
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

## Remaining Hardening Backlog

- Add a real persistent rate-limit backend such as Redis for multi-process production deployments.
- Add CSRF-aware stateful wrappers for all sensitive Server Actions that are not already protected by framework form semantics.
- Convert remaining raw-throw Server Actions to `useActionState` responses for friendlier errors.
- Add integration tests for:
  - file download permissions
  - assignment submission visibility
  - board image visibility
  - parent/student data boundaries
  - direct conversation participant-only access
- Add structured audit logs for admin changes, grade publication, user edits, and document generation.
- Add security headers at the deployment/proxy level:
  - `Content-Security-Policy`
  - `Referrer-Policy`
  - `Permissions-Policy`
  - `Strict-Transport-Security` in HTTPS production
- Add malware scanning before accepting production file uploads.
