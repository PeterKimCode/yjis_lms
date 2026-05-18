import "server-only"

import { NotificationType } from "@prisma/client"

import { getPrismaClient } from "@/lib/prisma"
import { requireAuth } from "@/modules/auth/permissions"
import { notificationTypeLabels } from "@/modules/notifications/types"

export async function getNotificationCenter({
  filter = "all",
  q = "",
}: {
  filter?: string
  q?: string
}) {
  const user = await requireAuth()
  const search = q.trim()
  const typeFilter = getTypeFilter(filter)
  const notifications = await getPrismaClient().notification.findMany({
    where: {
      userId: user.id,
      archivedAt: null,
      ...(filter === "unread" ? { readAt: null } : {}),
      ...(typeFilter ? { type: { in: typeFilter } } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              { body: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  })

  return {
    filter,
    notifications: notifications.map((notification) => ({
      ...notification,
      typeLabel: notificationTypeLabels[notification.type] ?? notification.type,
    })),
    q,
    user,
  }
}

function getTypeFilter(filter: string): NotificationType[] | null {
  const map: Record<string, NotificationType[]> = {
    assignments: [
      "ASSIGNMENT_DUE",
      "NEW_ASSIGNMENT",
      "ASSIGNMENT_SUBMITTED",
      "ASSIGNMENT_GRADED",
    ],
    attendance: ["ATTENDANCE_CHANGED", "ATTENDANCE_UPDATED"],
    boards: ["NEW_POST", "NEW_COMMENT", "NEW_BOARD_POST", "NEW_BOARD_COMMENT"],
    documents: ["REPORT_CARD_AVAILABLE", "TRANSCRIPT_AVAILABLE"],
    grades: ["GRADE_PUBLISHED", "FINAL_GRADE_PUBLISHED"],
    messages: ["NEW_MESSAGE"],
    quizzes: ["QUIZ_OPENED", "NEW_QUIZ", "QUIZ_GRADED"],
  }

  return map[filter] ?? null
}
