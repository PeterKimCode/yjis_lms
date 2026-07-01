import { UserRole } from "@prisma/client"

export const selectableUserRoles = [
  UserRole.SUPER_ADMIN,
  UserRole.SCHOOL_ADMIN,
  UserRole.INSTRUCTOR,
  UserRole.STUDENT,
  UserRole.PARENT,
] as const

export function isSelectableUserRole(role: UserRole) {
  return (selectableUserRoles as readonly UserRole[]).includes(role)
}

export function getSelectableUserRoles({
  canManageAdminRoles,
}: {
  canManageAdminRoles: boolean
}) {
  return selectableUserRoles.filter(
    (role) =>
      canManageAdminRoles ||
      (role !== UserRole.SUPER_ADMIN && role !== UserRole.SCHOOL_ADMIN)
  )
}
