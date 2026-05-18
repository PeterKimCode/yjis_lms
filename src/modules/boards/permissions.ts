import "server-only"

import { UserRole } from "@prisma/client"

import { getPrismaClient } from "@/lib/prisma"
import {
  canManageBoard,
  canViewClassSection,
  getCurrentUser,
} from "@/modules/auth/permissions"
import { getBoardSettings } from "@/modules/boards/constants"

export async function getBoardAccess(boardId: string) {
  const user = await getCurrentUser()
  const prisma = getPrismaClient()
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    include: {
      classSection: {
        include: {
          enrollments: { select: { studentId: true } },
        },
      },
    },
  })

  if (!user || !board) {
    return {
      board,
      canComment: false,
      canManage: false,
      canPost: false,
      canView: false,
      user,
    }
  }

  const settings = getBoardSettings(board.settings)
  const canManage = await canManageBoard(user.id, board.id)
  const canView =
    canManage || (board.isActive && (await canUserViewBoard(user.id, board)))
  const hasStudentRole = user.roleAssignments.some(
    (assignment) => assignment.role === UserRole.STUDENT
  )
  const hasParentRole = user.roleAssignments.some(
    (assignment) => assignment.role === UserRole.PARENT
  )

  return {
    board,
    canComment: canView && settings.allowComments,
    canManage,
    canPost:
      canManage ||
      (canView && hasStudentRole && settings.allowStudentPosts) ||
      (canView && hasParentRole && settings.allowParentPosts),
    canView,
    user,
  }
}

export async function canUserViewBoard(
  userId: string,
  board: {
    campusId: string | null
    classSectionId: string | null
    organizationId: string
  }
) {
  const prisma = getPrismaClient()
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      roleAssignments: true,
      studentProfile: true,
      parentRelations: {
        include: {
          student: {
            include: {
              enrollments: {
                select: { classSectionId: true },
              },
              studentProfile: true,
            },
          },
        },
      },
    },
  })

  if (!user || user.organizationId !== board.organizationId) return false

  if (board.classSectionId) {
    if (await canViewClassSection(userId, board.classSectionId)) return true

    return user.parentRelations.some((relation) =>
      relation.student.enrollments.some(
        (enrollment) => enrollment.classSectionId === board.classSectionId
      )
    )
  }

  if (!board.campusId) return true

  return (
    user.roleAssignments.some(
      (assignment) =>
        assignment.organizationId === board.organizationId &&
        (!assignment.campusId || assignment.campusId === board.campusId)
    ) ||
    user.studentProfile?.campusId === board.campusId ||
    user.parentRelations.some(
      (relation) => relation.student.studentProfile?.campusId === board.campusId
    )
  )
}
