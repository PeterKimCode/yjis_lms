import { UserRole } from "@prisma/client"

export type AdminScopeAssignment = {
  role: UserRole
  organizationId: string
  campusId: string | null
}

export const adminRoles: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ORG_ADMIN,
  UserRole.SCHOOL_ADMIN,
  UserRole.ACADEMIC_STAFF,
]

export function hasSuperAdminRole(assignments: AdminScopeAssignment[]) {
  return assignments.some((assignment) => assignment.role === UserRole.SUPER_ADMIN)
}

export function getAdminAssignments(assignments: AdminScopeAssignment[]) {
  return assignments.filter((assignment) => adminRoles.includes(assignment.role))
}

export function canAccessAdminScope(
  assignments: AdminScopeAssignment[],
  input: { organizationId: string; campusId?: string | null }
) {
  if (hasSuperAdminRole(assignments)) return true

  return getAdminAssignments(assignments).some(
    (assignment) =>
      assignment.organizationId === input.organizationId &&
      (!assignment.campusId ||
        !input.campusId ||
        assignment.campusId === input.campusId)
  )
}
