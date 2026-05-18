import "server-only"

import { UserRole } from "@prisma/client"

import { getPrismaClient } from "@/lib/prisma"
import {
  canAccessConversation,
  canManageClassSection,
  canViewClassSection,
} from "@/modules/auth/permissions"

export async function canStudentMessageTeacher(
  studentUserId: string,
  teacherUserId: string,
  classSectionId?: string | null
) {
  const shared = await getSharedStudentTeacherClassSection(
    studentUserId,
    teacherUserId,
    classSectionId
  )

  return Boolean(shared)
}

export async function canTeacherMessageStudent(
  teacherUserId: string,
  studentUserId: string,
  classSectionId?: string | null
) {
  return canStudentMessageTeacher(studentUserId, teacherUserId, classSectionId)
}

export async function canParentMessageTeacher(
  parentUserId: string,
  teacherUserId: string,
  classSectionId?: string | null
) {
  const relation = await getPrismaClient().parentStudentRelation.findFirst({
    where: {
      parentId: parentUserId,
      student: {
        enrollments: {
          some: {
            ...(classSectionId ? { classSectionId } : {}),
            classSection: {
              instructors: {
                some: { instructorId: teacherUserId },
              },
            },
          },
        },
      },
    },
    select: {
      student: {
        select: {
          name: true,
          enrollments: {
            where: {
              ...(classSectionId ? { classSectionId } : {}),
              classSection: {
                instructors: {
                  some: { instructorId: teacherUserId },
                },
              },
            },
            take: 1,
            select: {
              classSection: {
                select: {
                  id: true,
                  name: true,
                  course: { select: { title: true } },
                },
              },
            },
          },
        },
      },
    },
  })

  const classSection = relation?.student.enrollments[0]?.classSection
  if (!classSection) return null

  return {
    classSectionId: classSection.id,
    label: `${relation.student.name ?? "Linked student"} - ${classSection.course.title}`,
  }
}

export async function getSharedStudentTeacherClassSection(
  studentUserId: string,
  teacherUserId: string,
  classSectionId?: string | null
) {
  return getPrismaClient().enrollment.findFirst({
    where: {
      studentId: studentUserId,
      ...(classSectionId ? { classSectionId } : {}),
      classSection: {
        instructors: {
          some: { instructorId: teacherUserId },
        },
      },
    },
    select: {
      classSection: {
        select: {
          id: true,
          name: true,
          course: { select: { title: true } },
        },
      },
    },
  })
}

export async function canSendInConversation(userId: string, conversationId: string) {
  const participant = await getPrismaClient().conversationParticipant.findUnique({
    where: {
      conversationId_userId: {
        conversationId,
        userId,
      },
    },
    select: { id: true },
  })

  return Boolean(participant) || canAccessConversation(userId, conversationId)
}

export async function canCreateClassGroupConversation(
  userId: string,
  classSectionId: string
) {
  return canManageClassSection(userId, classSectionId)
}

export async function canJoinClassGroupConversation(
  userId: string,
  classSectionId: string
) {
  return canViewClassSection(userId, classSectionId)
}

export function hasRole(
  user: { roleAssignments: { role: UserRole }[] },
  role: UserRole
) {
  return user.roleAssignments.some((assignment) => assignment.role === role)
}
