import "server-only"

import { NotificationChannel, NotificationType } from "@prisma/client"

import { getPrismaClient } from "@/lib/prisma"

type NotificationPayload = {
  actionUrl?: string | null
  body?: string | null
  entityId?: string | null
  entityType?: string | null
  title: string
  type: NotificationType
}

export async function createNotification({
  actionUrl,
  actorUserId,
  body,
  entityId,
  entityType,
  title,
  type,
  userId,
}: NotificationPayload & { actorUserId?: string | null; userId: string }) {
  if (actorUserId && actorUserId === userId) return null

  const prisma = getPrismaClient()
  const user = await prisma.user.findFirst({
    where: { id: userId, isActive: true },
    select: { id: true, organizationId: true },
  })

  if (!user || !(await isNotificationEnabled(user.id, type))) return null

  const safeActionUrl = normalizeActionUrl(actionUrl)
  const existing = entityType && entityId
    ? await prisma.notification.findFirst({
        where: {
          userId: user.id,
          type,
          entityType,
          entityId,
          createdAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
        },
        select: { id: true },
      })
    : null

  if (existing) return null

  return prisma.notification.create({
    data: {
      organizationId: user.organizationId,
      userId: user.id,
      type,
      channel: NotificationChannel.IN_APP,
      title: title.slice(0, 180),
      body: body ? truncate(body, 500) : null,
      actionUrl: safeActionUrl,
      entityType,
      entityId,
    },
  })
}

export async function createNotificationsForUsers(
  userIds: string[],
  payload: NotificationPayload & { actorUserId?: string | null }
) {
  const uniqueUserIds = [...new Set(userIds)].filter(
    (userId) => userId && userId !== payload.actorUserId
  )

  await Promise.all(
    uniqueUserIds.map((userId) => createNotification({ ...payload, userId }))
  )
}

export async function notifyClassStudents(
  classSectionId: string,
  payload: NotificationPayload & { actorUserId?: string | null }
) {
  const enrollments = await getPrismaClient().enrollment.findMany({
    where: { classSectionId },
    select: { studentId: true },
  })
  await createNotificationsForUsers(
    enrollments.map((item) => item.studentId),
    payload
  )
}

export async function notifyClassInstructors(
  classSectionId: string,
  payload: NotificationPayload & { actorUserId?: string | null }
) {
  const instructors = await getPrismaClient().classSectionInstructor.findMany({
    where: { classSectionId },
    select: { instructorId: true },
  })
  await createNotificationsForUsers(
    instructors.map((item) => item.instructorId),
    payload
  )
}

export async function notifyLinkedParentsForStudent(
  studentId: string,
  payload: NotificationPayload & { actorUserId?: string | null }
) {
  const relations = await getPrismaClient().parentStudentRelation.findMany({
    where: { studentId },
    select: { parentId: true },
  })
  await createNotificationsForUsers(
    relations.map((item) => item.parentId),
    payload
  )
}

export async function getUnreadNotificationCount(userId: string) {
  return getPrismaClient().notification.count({
    where: { userId, readAt: null, archivedAt: null },
  })
}

export async function markNotificationRead(notificationId: string, userId: string) {
  return getPrismaClient().notification.updateMany({
    where: { id: notificationId, userId },
    data: { readAt: new Date() },
  })
}

export async function markNotificationUnread(
  notificationId: string,
  userId: string
) {
  return getPrismaClient().notification.updateMany({
    where: { id: notificationId, userId },
    data: { readAt: null },
  })
}

export async function markAllNotificationsRead(userId: string) {
  return getPrismaClient().notification.updateMany({
    where: { userId, readAt: null, archivedAt: null },
    data: { readAt: new Date() },
  })
}

export async function archiveNotification(notificationId: string, userId: string) {
  return getPrismaClient().notification.updateMany({
    where: { id: notificationId, userId },
    data: { archivedAt: new Date() },
  })
}

async function isNotificationEnabled(userId: string, type: NotificationType) {
  const preference = await getPrismaClient().notificationPreference.findUnique({
    where: {
      userId_type_channel: {
        userId,
        type,
        channel: NotificationChannel.IN_APP,
      },
    },
    select: { enabled: true },
  })

  return preference?.enabled ?? true
}

function normalizeActionUrl(actionUrl?: string | null) {
  if (!actionUrl || !actionUrl.startsWith("/") || actionUrl.startsWith("//")) {
    return null
  }

  return actionUrl.slice(0, 500)
}

function truncate(value: string, length: number) {
  return value.length > length ? `${value.slice(0, length - 1)}...` : value
}
