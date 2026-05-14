import "server-only"

import { UserRole } from "@prisma/client"

import { getPrismaClient } from "@/lib/prisma"
import { getAdminScopeFilter, requireAdmin } from "@/modules/admin/access"

export async function getAdminData() {
  const user = await requireAdmin()
  const prisma = getPrismaClient()
  const scope = getAdminScopeFilter(user)
  const isSuperAdmin = user.roleAssignments.some(
    (assignment) => assignment.role === UserRole.SUPER_ADMIN
  )
  const organizationIds = [
    ...new Set(user.roleAssignments.map((assignment) => assignment.organizationId)),
  ]

  const organizations = await prisma.organization.findMany({
    where: isSuperAdmin ? {} : { id: { in: organizationIds } },
    orderBy: { name: "asc" },
  })

  const campuses = await prisma.campus.findMany({
    where: isSuperAdmin
      ? {}
      : {
          OR: user.roleAssignments.map((assignment) => ({
            organizationId: assignment.organizationId,
            ...(assignment.campusId ? { id: assignment.campusId } : {}),
          })),
        },
    include: { organization: true },
    orderBy: [{ organization: { name: "asc" } }, { name: "asc" }],
  })

  return {
    user,
    scope,
    organizations,
    campuses,
    organizationOptions: organizations.map((organization) => ({
      id: organization.id,
      label: organization.name,
    })),
    campusOptions: campuses.map((campus) => ({
      id: campus.id,
      label: `${campus.name} (${campus.organization.name})`,
    })),
  }
}

export async function getAcademicSetupOptions() {
  const admin = await getAdminData()
  const prisma = getPrismaClient()

  const [
    academicYears,
    terms,
    gradeLevels,
    homerooms,
    departments,
    courses,
    classSections,
    users,
  ] = await Promise.all([
      prisma.academicYear.findMany({
        where: admin.scope,
        orderBy: { startsAt: "desc" },
      }),
      prisma.term.findMany({
        where: admin.scope,
        orderBy: [{ startsAt: "desc" }, { sequence: "asc" }],
      }),
      prisma.gradeLevel.findMany({
        where: admin.scope,
        orderBy: [{ sequence: "asc" }, { name: "asc" }],
      }),
      prisma.homeroom.findMany({
        where: admin.scope,
        orderBy: { name: "asc" },
      }),
      prisma.department.findMany({
        where: admin.scope,
        orderBy: { name: "asc" },
      }),
      prisma.course.findMany({
        where: admin.scope,
        orderBy: { title: "asc" },
      }),
      prisma.classSection.findMany({
        where: admin.scope,
        orderBy: { name: "asc" },
      }),
      prisma.user.findMany({
        where: {
          isActive: true,
          organizationId: { in: admin.organizations.map((org) => org.id) },
        },
        orderBy: { name: "asc" },
      }),
    ])

  return {
    ...admin,
    academicYears,
    terms,
    gradeLevels,
    homerooms,
    departments,
    courses,
    classSections,
    userOptions: users.map((user) => ({
      id: user.id,
      label: `${user.name}${user.email ? ` (${user.email})` : ""}`,
    })),
    academicYearOptions: academicYears.map((year) => ({
      id: year.id,
      label: year.name,
    })),
    termOptions: terms.map((term) => ({
      id: term.id,
      label: term.name,
    })),
    gradeLevelOptions: gradeLevels.map((gradeLevel) => ({
      id: gradeLevel.id,
      label: gradeLevel.name,
    })),
    homeroomOptions: homerooms.map((homeroom) => ({
      id: homeroom.id,
      label: homeroom.name,
    })),
    departmentOptions: departments.map((department) => ({
      id: department.id,
      label: department.name,
    })),
    courseOptions: courses.map((course) => ({
      id: course.id,
      label: course.title,
    })),
  }
}

export function formatDate(value: Date | null | undefined) {
  if (!value) return ""
  return value.toISOString().slice(0, 10)
}
