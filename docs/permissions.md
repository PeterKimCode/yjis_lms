# Scoped RBAC Permission Helpers

All future server mutations should call `src/modules/auth/permissions.ts` before changing data. The helpers are server-only and use active Auth.js sessions plus Prisma role assignments.

## Examples

```ts
import {
  canManageClassSection,
  requireAnyRole,
  requireOrganizationScope,
} from "@/modules/auth/permissions"
import { UserRole } from "@prisma/client"

export async function updateOrganizationSettings(organizationId: string) {
  await requireAnyRole([
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.SCHOOL_ADMIN,
  ])
  await requireOrganizationScope(organizationId)

  // mutate organization settings here
}

export async function createAssignment(userId: string, classSectionId: string) {
  if (!(await canManageClassSection(userId, classSectionId))) {
    throw new Error("Forbidden")
  }

  // create assignment here
}
```

## Rule Summary

- `SUPER_ADMIN` can access all scopes.
- `ORG_ADMIN` manages data in the assigned organization.
- `SCHOOL_ADMIN` manages data in the assigned campus.
- `ACADEMIC_STAFF` manages academic data in the assigned organization or campus scope.
- `INSTRUCTOR` manages assigned class sections.
- `HOMEROOM_TEACHER` manages students in assigned homeroom-linked sections.
- `STUDENT` views only their own data.
- `PARENT` views only linked students.
