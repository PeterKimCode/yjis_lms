import type { SessionRoleAssignment } from "@/modules/auth/auth"

const adminRoles = new Set([
  "SUPER_ADMIN",
  "ORG_ADMIN",
  "SCHOOL_ADMIN",
  "ACADEMIC_STAFF",
])

const instructorRoles = new Set(["INSTRUCTOR", "HOMEROOM_TEACHER"])

export function getPostLoginPath(roleAssignments: SessionRoleAssignment[]) {
  const roles = roleAssignments.map((assignment) => assignment.role)

  if (roles.some((role) => adminRoles.has(role))) {
    return "/admin"
  }

  if (roles.some((role) => instructorRoles.has(role))) {
    return "/instructor"
  }

  if (roles.includes("STUDENT")) {
    return "/student"
  }

  if (roles.includes("PARENT")) {
    return "/parent"
  }

  return "/"
}
