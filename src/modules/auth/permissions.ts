import "server-only"

import { redirect } from "next/navigation"
import { UserRole, type User, type UserRoleAssignment } from "@prisma/client"

import { getPrismaClient } from "@/lib/prisma"
import { getCurrentSession } from "@/modules/auth/session"

type RoleAssignmentSummary = Pick<
  UserRoleAssignment,
  "role" | "organizationId" | "campusId" | "startsAt" | "endsAt"
>

type AuthenticatedUser = Pick<User, "id" | "email" | "name" | "isActive"> & {
  roleAssignments: RoleAssignmentSummary[]
}

const organizationManagerRoles = new Set<UserRole>([
  UserRole.ORG_ADMIN,
  UserRole.ACADEMIC_STAFF,
])

const campusManagerRoles = new Set<UserRole>([
  UserRole.SCHOOL_ADMIN,
  UserRole.ACADEMIC_STAFF,
])

export class PermissionError extends Error {
  constructor(message = "Forbidden") {
    super(message)
    this.name = "PermissionError"
  }
}

export async function getCurrentUser() {
  const session = await getCurrentSession()

  if (!session?.user?.id) {
    return null
  }

  return getUserWithRoles(session.user.id)
}

export async function getCurrentUserRoleAssignments() {
  const user = await getCurrentUser()

  return user?.roleAssignments ?? []
}

export async function requireAuth() {
  const user = await getCurrentUser()

  if (!user) {
    redirect("/login")
  }

  return user
}

export async function requireAnyRole(roles: UserRole[]) {
  const user = await requireAuth()

  if (!hasAnyRole(user.roleAssignments, roles)) {
    throw new PermissionError()
  }

  return user
}

export async function requireOrganizationScope(organizationId: string) {
  const user = await requireAuth()

  if (!canAccessOrganization(user.roleAssignments, organizationId)) {
    throw new PermissionError()
  }

  return user
}

export async function requireCampusScope(campusId: string) {
  const user = await requireAuth()
  const campus = await getPrismaClient().campus.findUnique({
    where: { id: campusId },
    select: { organizationId: true },
  })

  if (
    !campus ||
    !canAccessCampus(user.roleAssignments, campus.organizationId, campusId)
  ) {
    throw new PermissionError()
  }

  return user
}

export async function canManageClassSection(
  userId: string,
  classSectionId: string
) {
  const prisma = getPrismaClient()
  const [user, classSection] = await Promise.all([
    getUserWithRoles(userId),
    prisma.classSection.findUnique({
      where: { id: classSectionId },
      select: {
        organizationId: true,
        campusId: true,
        homeroom: {
          select: {
            teacherId: true,
          },
        },
      },
    }),
  ])

  if (!user || !classSection) {
    return false
  }

  if (
    canManageScopedAcademicData(
      user.roleAssignments,
      classSection.organizationId,
      classSection.campusId
    )
  ) {
    return true
  }

  const [assignedInstructor, isHomeroomTeacher] = await Promise.all([
    prisma.classSectionInstructor.findUnique({
      where: {
        classSectionId_instructorId: {
          classSectionId,
          instructorId: userId,
        },
      },
      select: { id: true },
    }),
    hasHomeroomTeacherAuthority(user, classSection.homeroom?.teacherId),
  ])

  return Boolean(assignedInstructor || isHomeroomTeacher)
}

export async function canViewClassSection(
  userId: string,
  classSectionId: string
) {
  if (await canManageClassSection(userId, classSectionId)) {
    return true
  }

  const prisma = getPrismaClient()
  const [enrollment, linkedStudentEnrollment] = await Promise.all([
    prisma.enrollment.findUnique({
      where: {
        classSectionId_studentId: {
          classSectionId,
          studentId: userId,
        },
      },
      select: { id: true },
    }),
    prisma.enrollment.findFirst({
      where: {
        classSectionId,
        student: {
          studentParentRelations: {
            some: {
              parentId: userId,
            },
          },
        },
      },
      select: { id: true },
    }),
  ])

  return Boolean(enrollment || linkedStudentEnrollment)
}

export async function canViewStudentData(userId: string, studentId: string) {
  if (userId === studentId) {
    return true
  }

  if (await canManageStudentData(userId, studentId)) {
    return true
  }

  const prisma = getPrismaClient()
  const [parentRelation, teachesStudent] = await Promise.all([
    prisma.parentStudentRelation.findUnique({
      where: {
        parentId_studentId: {
          parentId: userId,
          studentId,
        },
      },
      select: { id: true },
    }),
    prisma.enrollment.findFirst({
      where: {
        studentId,
        classSection: {
          instructors: {
            some: {
              instructorId: userId,
            },
          },
        },
      },
      select: { id: true },
    }),
  ])

  return Boolean(parentRelation || teachesStudent)
}

export async function canManageStudentData(userId: string, studentId: string) {
  const prisma = getPrismaClient()
  const [user, studentProfile] = await Promise.all([
    getUserWithRoles(userId),
    prisma.studentProfile.findUnique({
      where: { userId: studentId },
      select: {
        organizationId: true,
        campusId: true,
      },
    }),
  ])

  if (!user || !studentProfile) {
    return false
  }

  if (
    canManageScopedAcademicData(
      user.roleAssignments,
      studentProfile.organizationId,
      studentProfile.campusId
    )
  ) {
    return true
  }

  const managedEnrollment = await prisma.enrollment.findFirst({
    where: {
      studentId,
      classSection: {
        OR: [
          {
            instructors: {
              some: {
                instructorId: userId,
              },
            },
          },
          {
            homeroom: {
              teacherId: userId,
            },
          },
        ],
      },
    },
    select: { id: true },
  })

  return Boolean(managedEnrollment)
}

export async function canManageBoard(userId: string, boardId: string) {
  const prisma = getPrismaClient()
  const [user, board] = await Promise.all([
    getUserWithRoles(userId),
    prisma.board.findUnique({
      where: { id: boardId },
      select: {
        organizationId: true,
        campusId: true,
        classSectionId: true,
        homeroom: {
          select: {
            teacherId: true,
          },
        },
      },
    }),
  ])

  if (!user || !board) {
    return false
  }

  if (
    canManageScopedAcademicData(
      user.roleAssignments,
      board.organizationId,
      board.campusId
    )
  ) {
    return true
  }

  if (
    board.classSectionId &&
    (await canManageClassSection(userId, board.classSectionId))
  ) {
    return true
  }

  return hasHomeroomTeacherAuthority(user, board.homeroom?.teacherId)
}

export async function canAccessConversation(
  userId: string,
  conversationId: string
) {
  const prisma = getPrismaClient()
  const [user, conversation, participant] = await Promise.all([
    getUserWithRoles(userId),
    prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        organizationId: true,
        campusId: true,
        classSectionId: true,
        homeroom: {
          select: {
            teacherId: true,
          },
        },
      },
    }),
    prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
      select: { id: true },
    }),
  ])

  if (!user || !conversation) {
    return false
  }

  if (participant) {
    return true
  }

  if (
    canManageScopedAcademicData(
      user.roleAssignments,
      conversation.organizationId,
      conversation.campusId
    )
  ) {
    return true
  }

  if (
    conversation.classSectionId &&
    (await canViewClassSection(userId, conversation.classSectionId))
  ) {
    return true
  }

  return hasHomeroomTeacherAuthority(user, conversation.homeroom?.teacherId)
}

async function getUserWithRoles(userId: string) {
  const now = new Date()

  return getPrismaClient().user.findFirst({
    where: {
      id: userId,
      isActive: true,
    },
    select: {
      id: true,
      email: true,
      name: true,
      isActive: true,
      roleAssignments: {
        where: {
          AND: [
            {
              OR: [{ startsAt: null }, { startsAt: { lte: now } }],
            },
            {
              OR: [{ endsAt: null }, { endsAt: { gt: now } }],
            },
          ],
        },
        select: {
          role: true,
          organizationId: true,
          campusId: true,
          startsAt: true,
          endsAt: true,
        },
      },
    },
  })
}

function hasAnyRole(assignments: RoleAssignmentSummary[], roles: UserRole[]) {
  return assignments.some((assignment) => roles.includes(assignment.role))
}

function hasRole(assignments: RoleAssignmentSummary[], role: UserRole) {
  return assignments.some((assignment) => assignment.role === role)
}

function isSuperAdmin(assignments: RoleAssignmentSummary[]) {
  return hasRole(assignments, UserRole.SUPER_ADMIN)
}

function canAccessOrganization(
  assignments: RoleAssignmentSummary[],
  organizationId: string
) {
  return (
    isSuperAdmin(assignments) ||
    assignments.some((assignment) => assignment.organizationId === organizationId)
  )
}

function canAccessCampus(
  assignments: RoleAssignmentSummary[],
  organizationId: string,
  campusId: string
) {
  return (
    isSuperAdmin(assignments) ||
    assignments.some(
      (assignment) =>
        assignment.organizationId === organizationId &&
        (assignment.campusId === null || assignment.campusId === campusId)
    )
  )
}

function canManageScopedAcademicData(
  assignments: RoleAssignmentSummary[],
  organizationId: string,
  campusId: string | null
) {
  if (isSuperAdmin(assignments)) {
    return true
  }

  return assignments.some((assignment) => {
    if (assignment.organizationId !== organizationId) {
      return false
    }

    if (organizationManagerRoles.has(assignment.role)) {
      return assignment.campusId === null
    }

    if (campusManagerRoles.has(assignment.role)) {
      return (
        campusId !== null &&
        assignment.campusId !== null &&
        assignment.campusId === campusId
      )
    }

    if (assignment.role === UserRole.SCHOOL_ADMIN) {
      return campusId !== null && assignment.campusId === campusId
    }

    return false
  })
}

function hasHomeroomTeacherAuthority(
  user: AuthenticatedUser,
  teacherId: string | null | undefined
) {
  return (
    teacherId === user.id &&
    hasRole(user.roleAssignments, UserRole.HOMEROOM_TEACHER)
  )
}
