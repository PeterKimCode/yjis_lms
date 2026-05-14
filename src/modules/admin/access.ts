import "server-only"

import { UserRole } from "@prisma/client"

import {
  requireAnyRole,
  requireCampusScope,
  requireOrganizationScope,
} from "@/modules/auth/permissions"

export const adminRoles: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ORG_ADMIN,
  UserRole.SCHOOL_ADMIN,
  UserRole.ACADEMIC_STAFF,
]

type AdminUser = Awaited<ReturnType<typeof requireAdmin>>

export async function requireAdmin() {
  return requireAnyRole(adminRoles)
}

export function isSuperAdmin(user: AdminUser) {
  return user.roleAssignments.some(
    (assignment) => assignment.role === UserRole.SUPER_ADMIN
  )
}

function adminAssignments(user: AdminUser) {
  return user.roleAssignments.filter((assignment) =>
    adminRoles.includes(assignment.role)
  )
}

export function getOrganizationWhereForAdmin(user: AdminUser) {
  if (isSuperAdmin(user)) return {}

  return {
    id: {
      in: [...new Set(adminAssignments(user).map((item) => item.organizationId))],
    },
  }
}

export function getCampusWhereForAdmin(user: AdminUser) {
  if (isSuperAdmin(user)) return {}

  return {
    OR: adminAssignments(user).map((assignment) => ({
      organizationId: assignment.organizationId,
      ...(assignment.campusId ? { id: assignment.campusId } : {}),
    })),
  }
}

export function getScopedWhereForAdmin(user: AdminUser) {
  if (isSuperAdmin(user)) return {}

  return {
    OR: adminAssignments(user).map((assignment) => ({
      organizationId: assignment.organizationId,
      ...(assignment.campusId ? { campusId: assignment.campusId } : {}),
    })),
  }
}

export const getAcademicYearWhereForAdmin = getScopedWhereForAdmin
export const getTermWhereForAdmin = getScopedWhereForAdmin
export const getGradeLevelWhereForAdmin = getScopedWhereForAdmin
export const getHomeroomWhereForAdmin = getScopedWhereForAdmin
export const getDepartmentWhereForAdmin = getScopedWhereForAdmin
export const getCourseWhereForAdmin = getScopedWhereForAdmin
export const getClassSectionWhereForAdmin = getScopedWhereForAdmin

export function getUserWhereForAdmin(user: AdminUser) {
  if (isSuperAdmin(user)) return {}

  return {
    organizationId: {
      in: [...new Set(adminAssignments(user).map((item) => item.organizationId))],
    },
  }
}

export async function assertAdminScope(input: {
  organizationId: string
  campusId?: string | null
}) {
  await requireAdmin()
  await requireOrganizationScope(input.organizationId)

  if (input.campusId) {
    await requireCampusScope(input.campusId)
  }
}
