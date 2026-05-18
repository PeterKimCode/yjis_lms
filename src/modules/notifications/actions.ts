"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireAuth } from "@/modules/auth/permissions"
import {
  archiveNotification,
  markAllNotificationsRead,
  markNotificationRead,
  markNotificationUnread,
} from "@/modules/notifications/service"
import type { NotificationActionState } from "@/modules/notifications/types"

const notificationSchema = z.object({
  notificationId: z.string().min(1),
})

export async function markNotificationReadAction(formData: FormData) {
  const user = await requireAuth()
  const data = notificationSchema.parse(Object.fromEntries(formData.entries()))
  await markNotificationRead(data.notificationId, user.id)
  revalidateNotifications()
}

export async function markNotificationUnreadAction(formData: FormData) {
  const user = await requireAuth()
  const data = notificationSchema.parse(Object.fromEntries(formData.entries()))
  await markNotificationUnread(data.notificationId, user.id)
  revalidateNotifications()
}

export async function archiveNotificationAction(formData: FormData) {
  const user = await requireAuth()
  const data = notificationSchema.parse(Object.fromEntries(formData.entries()))
  await archiveNotification(data.notificationId, user.id)
  revalidateNotifications()
}

export async function markAllNotificationsReadAction(): Promise<NotificationActionState> {
  const user = await requireAuth()
  await markAllNotificationsRead(user.id)
  revalidateNotifications()

  return { ok: true, message: "All notifications marked as read." }
}

function revalidateNotifications() {
  revalidatePath("/notifications")
  revalidatePath("/admin")
  revalidatePath("/instructor")
  revalidatePath("/student")
  revalidatePath("/parent")
}
