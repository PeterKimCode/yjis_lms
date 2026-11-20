import "server-only"
import { UserRole, type Prisma } from "@prisma/client"
import { getPrismaClient } from "@/lib/prisma"
import { getAdminAssignments, hasSuperAdminRole, type AdminScopeAssignment } from "@/modules/admin/scope-rules"
import { getCurrentUser } from "@/modules/auth/permissions"
import { dailyStatuses, schoolPhase, schoolScopeKey, schoolTime, type SchoolSchedule } from "./school-rules"

export type SchoolScope = { organizationId: string; campusId: string | null }

export function canManageSchoolAttendance(roles: AdminScopeAssignment[], scope: SchoolScope) {
  return hasSuperAdminRole(roles) || getAdminAssignments(roles).some((role) =>
    role.organizationId === scope.organizationId && (role.campusId === null || role.campusId === scope.campusId)
  )
}

export async function findSchoolStaffScope(scope: SchoolScope) {
  const actor = await getCurrentUser()
  if (!actor || !canManageSchoolAttendance(actor.roleAssignments, scope)) return null
  const prisma = getPrismaClient()
  const organization = await prisma.organization.findFirst({
    where: { id: scope.organizationId, isActive: true },
    select: { id: true, name: true, timezone: true },
  })
  if (!organization) return null
  const campus = scope.campusId ? await prisma.campus.findFirst({
    where: { id: scope.campusId, organizationId: scope.organizationId, isActive: true },
    select: { id: true, name: true },
  }) : null
  if (scope.campusId && !campus) return null
  return { actor, organization, campus, scope }
}

export async function getSchoolAttendanceScopes(roles: AdminScopeAssignment[]) {
  const assignments = getAdminAssignments(roles)
  const schools = await getPrismaClient().organization.findMany({
    where: {
      isActive: true,
      ...(hasSuperAdminRole(roles) ? {} : { id: { in: [...new Set(assignments.map((role) => role.organizationId))] } }),
    },
    select: {
      id: true, name: true, timezone: true,
      campuses: { where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } },
    },
    orderBy: { name: "asc" },
  })
  return schools.flatMap((school) => [
    { organizationId: school.id, campusId: null, label: school.name, timezone: school.timezone, schoolName: school.name },
    ...school.campuses.map((campus) => ({
      organizationId: school.id, campusId: campus.id, label: `${school.name} · ${campus.name}`, timezone: school.timezone, schoolName: school.name,
    })),
  ]).filter((scope) => canManageSchoolAttendance(roles, scope))
}

export function signedInRole(role: UserRole, now: Date, organizationId?: string): Prisma.UserRoleAssignmentWhereInput {
  return {
    role, organizationId, AND: [
      { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
      { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
    ],
  }
}

export function schoolStudents(scope: SchoolScope, now: Date): Prisma.UserWhereInput {
  return {
    organizationId: scope.organizationId,
    isActive: true,
    roleAssignments: { some: signedInRole(UserRole.STUDENT, now, scope.organizationId) },
    ...(scope.campusId ? { studentProfile: { organizationId: scope.organizationId, campusId: scope.campusId } } : {}),
  }
}

export const dailyStudentSelect = {
  id: true, name: true,
  studentProfile: {
    select: {
      organizationId: true, campusId: true, campus: { select: { isActive: true, name: true, organizationId: true } },
      currentGradeLevel: { select: { id: true, name: true } }, homeroom: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.UserSelect

export function studentCampus(student: {
  studentProfile: {
    organizationId: string
    campusId: string | null
    campus: { organizationId: string; isActive: boolean } | null
  } | null
}, organizationId: string) {
  const profile = student.studentProfile
  return profile?.organizationId === organizationId && profile.campus?.organizationId === organizationId && profile.campus.isActive
    ? profile.campusId : null
}

export async function getSchoolSchedules(organizationId: string) {
  return getPrismaClient().schoolAttendanceSchedule.findMany({ where: { organizationId } })
}

export function effectiveSchoolSchedule<T extends SchoolSchedule>(schedules: Iterable<T & { scopeKey: string }>, scope: SchoolScope) {
  const byScope = new Map([...schedules].map((schedule) => [schedule.scopeKey, schedule]))
  return byScope.get(schoolScopeKey(scope.organizationId, scope.campusId)) ??
    byScope.get(schoolScopeKey(scope.organizationId, null)) ?? null
}

export function getSchoolAttendanceDay(
  scope: SchoolScope,
  timezone: string,
  schedules: Awaited<ReturnType<typeof getSchoolSchedules>>,
  now: Date
) {
  const time = schoolTime(now, timezone)
  const schedule = effectiveSchoolSchedule(schedules, scope)
  const phase = schoolPhase(schedule, time)
  const overrides = scope.campusId ? [] : schedules.filter((item) => item.campusId !== null)
  const overridePhases = overrides.map((item) => ({ campusId: item.campusId!, phase: schoolPhase(item, time) }))
  const isScheduled = (phase: ReturnType<typeof schoolPhase>) => phase !== "setup" && phase !== "closed-day"
  const campusProfile = (ids: string[]): Prisma.StudentProfileWhereInput => ({
    organizationId: scope.organizationId, campusId: { in: ids }, campus: { isActive: true, organizationId: scope.organizationId },
  })
  const recordOnDay = { organizationId: scope.organizationId, schoolDate: time.date }
  const settled = { ...recordOnDay, status: { in: [...dailyStatuses] } }
  const schoolDay: Prisma.UserWhereInput = {
    OR: [
      { schoolAttendanceRecords: { some: settled } },
      { studentProfile: campusProfile(overridePhases.filter((item) => isScheduled(item.phase)).map((item) => item.campusId)) },
      ...(isScheduled(phase) ? [{ NOT: { studentProfile: campusProfile(overridePhases.map((item) => item.campusId)) } }] : []),
    ],
  }
  return {
    time, schedule, phase, recordOnDay, settled, schoolDay,
    hasOverrides: overrides.length > 0,
    scannersOpen: phase === "open" || overridePhases.some((item) => item.phase === "open"),
    canReview: phase === "review" || overridePhases.some((item) => item.phase === "review"),
  }
}

export async function getDailyStudentContext() {
  const actor = await getCurrentUser()
  if (!actor?.roleAssignments.some((role) => role.role === UserRole.STUDENT && role.organizationId === actor.organizationId)) return null
  const prisma = getPrismaClient()
  const [school, student, schedules] = await Promise.all([
    prisma.organization.findFirst({
      where: { id: actor.organizationId, isActive: true }, select: { id: true, name: true, timezone: true },
    }),
    prisma.user.findUnique({ where: { id: actor.id }, select: dailyStudentSelect }),
    getSchoolSchedules(actor.organizationId),
  ])
  if (!school || !student) return null
  const scope = { organizationId: school.id, campusId: studentCampus(student, school.id) }
  return { school, student, scope, schedule: effectiveSchoolSchedule(schedules, scope) }
}
