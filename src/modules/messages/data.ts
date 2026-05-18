import "server-only"

import { ConversationType, UserRole } from "@prisma/client"

import { getPrismaClient } from "@/lib/prisma"
import { requireAuth } from "@/modules/auth/permissions"
import { conversationTypeLabels } from "@/modules/messages/types"

export async function getConversationList({
  filter = "all",
  q = "",
}: {
  filter?: string
  q?: string
}) {
  const user = await requireAuth()
  const search = q.trim()
  const prisma = getPrismaClient()
  const conversations = await prisma.conversation.findMany({
    where: {
      participants: { some: { userId: user.id } },
      ...(filter !== "all" && filter !== "unread"
        ? { type: filter as ConversationType }
        : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              {
                participants: {
                  some: {
                    user: {
                      OR: [
                        { name: { contains: search, mode: "insensitive" } },
                        { email: { contains: search, mode: "insensitive" } },
                      ],
                    },
                  },
                },
              },
              {
                messages: {
                  some: { body: { contains: search, mode: "insensitive" } },
                },
              },
            ],
          }
        : {}),
    },
    include: {
      classSection: {
        include: { course: true },
      },
      participants: {
        include: {
          user: {
            include: { roleAssignments: true },
          },
        },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { sender: true },
      },
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  })

  const rows = await Promise.all(
    conversations.map(async (conversation) => {
      const participant = conversation.participants.find(
        (item) => item.userId === user.id
      )
      const unreadCount = await prisma.message.count({
        where: {
          conversationId: conversation.id,
          senderId: { not: user.id },
          createdAt: participant?.lastReadAt
            ? { gt: participant.lastReadAt }
            : undefined,
        },
      })

      return {
        ...conversation,
        displayTitle: getConversationTitle(conversation, user.id),
        typeLabel: getConversationTypeLabel(conversation.type),
        unreadCount,
      }
    })
  )

  return {
    conversations:
      filter === "unread" ? rows.filter((row) => row.unreadCount > 0) : rows,
    q,
    filter,
    user,
  }
}

export async function getConversationDetail(conversationId: string) {
  const user = await requireAuth()
  const prisma = getPrismaClient()
  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      participants: { some: { userId: user.id } },
    },
    include: {
      classSection: { include: { course: true, term: true } },
      participants: {
        include: {
          user: { include: { roleAssignments: true } },
        },
        orderBy: { joinedAt: "asc" },
      },
      messages: {
        include: {
          sender: { include: { roleAssignments: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  })

  if (!conversation) return null

  await prisma.conversationParticipant.update({
    where: {
      conversationId_userId: {
        conversationId,
        userId: user.id,
      },
    },
    data: { lastReadAt: new Date() },
  })

  return {
    conversation,
    displayTitle: getConversationTitle(conversation, user.id),
    typeLabel: getConversationTypeLabel(conversation.type),
    user,
  }
}

export async function getConversationStartOptions() {
  const user = await requireAuth()
  const prisma = getPrismaClient()
  const roles = new Set(user.roleAssignments.map((assignment) => assignment.role))
  const directOptions: Array<{
    classSectionId: string
    description: string
    label: string
    targetKind: "PARENT" | "STAFF" | "STUDENT" | "TEACHER"
    type: "DIRECT" | "PARENT_TEACHER"
    userId: string
  }> = []
  const classGroupOptions: Array<{
    id: string
    label: string
  }> = []

  if (roles.has(UserRole.STUDENT)) {
    const enrollments = await prisma.enrollment.findMany({
      where: { studentId: user.id },
      include: {
        classSection: {
          include: {
            course: true,
            instructors: { include: { instructor: true } },
          },
        },
      },
    })

    for (const enrollment of enrollments) {
      classGroupOptions.push({
        id: enrollment.classSectionId,
        label: `${enrollment.classSection.course.title} - ${enrollment.classSection.name}`,
      })
      for (const instructor of enrollment.classSection.instructors) {
        directOptions.push({
          classSectionId: enrollment.classSectionId,
          description: enrollment.classSection.course.title,
          label: `${instructor.instructor.name ?? instructor.instructor.email} - Teacher`,
          targetKind: "TEACHER",
          type: "DIRECT",
          userId: instructor.instructorId,
        })
      }
    }
  }

  if (roles.has(UserRole.INSTRUCTOR) || roles.has(UserRole.HOMEROOM_TEACHER)) {
    const sections = await prisma.classSection.findMany({
      where: {
        OR: [
          { instructors: { some: { instructorId: user.id } } },
          { homeroom: { teacherId: user.id } },
        ],
      },
      include: {
        course: true,
        enrollments: {
          include: {
            student: {
              include: {
                studentParentRelations: {
                  include: { parent: true },
                },
              },
            },
          },
        },
      },
    })

    for (const section of sections) {
      classGroupOptions.push({
        id: section.id,
        label: `${section.course.title} - ${section.name}`,
      })
      for (const enrollment of section.enrollments) {
        directOptions.push({
          classSectionId: section.id,
          description: section.course.title,
          label: `${enrollment.student.name ?? enrollment.student.email} - Student`,
          targetKind: "STUDENT",
          type: "DIRECT",
          userId: enrollment.studentId,
        })
        for (const relation of enrollment.student.studentParentRelations) {
          directOptions.push({
            classSectionId: section.id,
            description: `${section.course.title} / ${enrollment.student.name ?? "Student"}`,
            label: `${relation.parent.name ?? relation.parent.email} - Parent`,
            targetKind: "PARENT",
            type: "PARENT_TEACHER",
            userId: relation.parentId,
          })
        }
      }
    }
  }

  if (roles.has(UserRole.PARENT)) {
    const relations = await prisma.parentStudentRelation.findMany({
      where: { parentId: user.id },
      include: {
        student: {
          include: {
            enrollments: {
              include: {
                classSection: {
                  include: {
                    course: true,
                    instructors: { include: { instructor: true } },
                  },
                },
              },
            },
          },
        },
      },
    })

    for (const relation of relations) {
      for (const enrollment of relation.student.enrollments) {
        for (const instructor of enrollment.classSection.instructors) {
          directOptions.push({
            classSectionId: enrollment.classSectionId,
            description: `${relation.student.name ?? "Linked student"} / ${enrollment.classSection.course.title}`,
            label: `${instructor.instructor.name ?? instructor.instructor.email} - Teacher`,
            targetKind: "TEACHER",
            type: "PARENT_TEACHER",
            userId: instructor.instructorId,
          })
        }
      }
    }
  }

  if (
    roles.has(UserRole.SUPER_ADMIN) ||
    roles.has(UserRole.ORG_ADMIN) ||
    roles.has(UserRole.SCHOOL_ADMIN) ||
    roles.has(UserRole.ACADEMIC_STAFF)
  ) {
    const users = await prisma.user.findMany({
      where: {
        id: { not: user.id },
        organizationId: user.roleAssignments[0]?.organizationId,
        isActive: true,
      },
      include: { roleAssignments: true },
      orderBy: { name: "asc" },
      take: 100,
    })
    for (const target of users) {
      directOptions.push({
        classSectionId: "",
        description: target.roleAssignments.map((role) => role.role).join(", "),
        label: target.name ?? target.email,
        targetKind: "STAFF",
        type: "DIRECT",
        userId: target.id,
      })
    }
  }

  return {
    classGroupOptions,
    directOptions,
    user,
  }
}

export async function getUnreadMessageCountForCurrentUser() {
  const user = await requireAuth()

  return getUnreadMessageCount(user.id)
}

export async function getUnreadMessageCount(userId: string) {
  const prisma = getPrismaClient()
  const participants = await prisma.conversationParticipant.findMany({
    where: { userId },
    select: {
      conversationId: true,
      lastReadAt: true,
    },
  })
  const counts = await Promise.all(
    participants.map((participant) =>
      prisma.message.count({
        where: {
          conversationId: participant.conversationId,
          senderId: { not: userId },
          createdAt: participant.lastReadAt
            ? { gt: participant.lastReadAt }
            : undefined,
        },
      })
    )
  )

  return counts.reduce((total, count) => total + count, 0)
}

function getConversationTitle(
  conversation: {
    title: string | null
    type: ConversationType
    classSection?: { course?: { title: string }; name: string } | null
    participants: {
      userId: string
      user: { email: string | null; name: string | null }
    }[]
  },
  currentUserId: string
) {
  if (conversation.title) return conversation.title
  if (conversation.type === ConversationType.CLASS_SECTION && conversation.classSection) {
    return `${conversation.classSection.course?.title ?? "Class"} - ${conversation.classSection.name}`
  }

  const others = conversation.participants.filter(
    (participant) => participant.userId !== currentUserId
  )

  return (
    others.map((item) => item.user.name ?? item.user.email ?? "User").join(", ") ||
    "Conversation"
  )
}

function getConversationTypeLabel(type: ConversationType) {
  return conversationTypeLabels[type] ?? type
}
