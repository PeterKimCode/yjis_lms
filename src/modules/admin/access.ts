import "server-only"

import { UserRole, type Prisma } from "@prisma/client"

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

export function getAdminScopeFilter(user: AdminUser) {
  if (
    user.roleAssignments.some(
      (assignment) => assignment.role === UserRole.SUPER_ADMIN
    )
  ) {
    return {}
  }

  const scopedAssignments = user.roleAssignments.filter((assignment) =>
    adminRoles.includes(assignment.role)
  )

  return {
    OR: scopedAssignments.map((assignment) => ({
      organizationId: assignment.organizationId,
      ...(assignment.campusId ? { campusId: assignment.campusId } : {}),
    })),
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

export function mergeScope<T extends Prisma.OrganizationWhereInput>(
  where: T,
  scope: Prisma.OrganizationWhereInput
) {
  if (!("OR" in scope)) {
    return where
  }

  return {
    AND: [where, scope],
  }
}
