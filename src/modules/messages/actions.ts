"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { ConversationType, NotificationType, UserRole } from "@prisma/client"
import { z } from "zod"

import { getPrismaClient } from "@/lib/prisma"
import { canManageClassSection, requireAuth } from "@/modules/auth/permissions"
import {
  canParentMessageTeacher,
  canSendInConversation,
  canStudentMessageTeacher,
  canTeacherMessageStudent,
} from "@/modules/messages/permissions"
import {
  MESSAGE_BODY_MAX_LENGTH,
  type MessageActionState,
} from "@/modules/messages/types"
import { createNotificationsForUsers } from "@/modules/notifications/service"

const optionalString = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() : ""),
  z.string().transform((value) => (value.length ? value : null))
)
const requiredString = z.string().trim().min(1)

const startConversationSchema = z.object({
  mode: z.enum(["DIRECT", "CLASS_SECTION", "PARENT_TEACHER"]),
  recipientUserId: optionalString,
  classSectionId: optionalString,
  body: requiredString.max(MESSAGE_BODY_MAX_LENGTH),
})

export async function startConversation(
  _previousState: MessageActionState,
  formData: FormData
): Promise<MessageActionState> {
  const parsed = startConversationSchema.safeParse(
    Object.fromEntries(formData.entries())
  )

  if (!parsed.success) {
    return { ok: false, message: "Choose a recipient and enter a message." }
  }

  const user = await requireAuth()
  const data = {
    ...parsed.data,
    recipientUserId: parseRecipientUserId(parsed.data.recipientUserId),
  }
  let conversationId: string

  try {
    const conversation =
      data.mode === "CLASS_SECTION"
        ? await createOrOpenClassGroup(user.id, data.classSectionId, data.body)
        : await createOrOpenDirectConversation({
            body: data.body,
            classSectionId: data.classSectionId,
            currentUser: user,
            mode: data.mode,
            recipientUserId: data.recipientUserId,
          })

    revalidatePath("/messages")
    conversationId = conversation.id
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Message could not be sent.",
    }
  }

  redirect(`/messages/${conversationId}`)
}

const sendMessageSchema = z.object({
  conversationId: requiredString,
  body: requiredString.max(MESSAGE_BODY_MAX_LENGTH),
})

export async function sendMessage(
  _previousState: MessageActionState,
  formData: FormData
): Promise<MessageActionState> {
  const parsed = sendMessageSchema.safeParse(Object.fromEntries(formData.entries()))

  if (!parsed.success) {
    return { ok: false, message: "Enter a message." }
  }

  const user = await requireAuth()
  const data = parsed.data

  if (!(await canSendInConversation(user.id, data.conversationId))) {
    return { ok: false, message: "You cannot send messages here." }
  }

  const prisma = getPrismaClient()
  const conversation = await prisma.conversation.findUniqueOrThrow({
    where: { id: data.conversationId },
    select: { organizationId: true },
  })

  await addMessage(data.conversationId, conversation.organizationId, user.id, data.body)

  revalidatePath("/messages")
  revalidatePath(`/messages/${data.conversationId}`)
  return { ok: true, message: "" }
}

const messageEditSchema = z.object({
  conversationId: requiredString,
  messageId: requiredString,
  body: requiredString.max(MESSAGE_BODY_MAX_LENGTH),
})

export async function editMessage(
  _previousState: MessageActionState,
  formData: FormData
): Promise<MessageActionState> {
  const parsed = messageEditSchema.safeParse(Object.fromEntries(formData.entries()))
  if (!parsed.success) return { ok: false, message: "Enter a message." }

  const user = await requireAuth()
  const message = await getPrismaClient().message.findUnique({
    where: { id: parsed.data.messageId },
    select: { senderId: true, conversationId: true },
  })

  if (
    !message ||
    message.conversationId !== parsed.data.conversationId ||
    message.senderId !== user.id
  ) {
    return { ok: false, message: "You can edit only your own message." }
  }

  await getPrismaClient().message.update({
    where: { id: parsed.data.messageId },
    data: { body: parsed.data.body },
  })
  revalidatePath(`/messages/${parsed.data.conversationId}`)
  return { ok: true, message: "Message updated." }
}

const deleteMessageSchema = z.object({
  conversationId: requiredString,
  messageId: requiredString,
})

export async function deleteMessage(formData: FormData) {
  const data = deleteMessageSchema.parse(Object.fromEntries(formData.entries()))
  const user = await requireAuth()
  const message = await getPrismaClient().message.findUnique({
    where: { id: data.messageId },
    select: { senderId: true, conversationId: true },
  })

  if (
    !message ||
    message.conversationId !== data.conversationId ||
    message.senderId !== user.id
  ) {
    revalidatePath(`/messages/${data.conversationId}`)
    return
  }

  await getPrismaClient().message.delete({ where: { id: data.messageId } })
  revalidatePath(`/messages/${data.conversationId}`)
}

export async function openClassConversation(formData: FormData) {
  const classSectionId = String(formData.get("classSectionId") ?? "")
  const user = await requireAuth()
  const conversation = await createOrOpenClassGroup(
    user.id,
    classSectionId,
    "Class conversation opened."
  )

  redirect(`/messages/${conversation.id}`)
}

async function createOrOpenDirectConversation({
  body,
  classSectionId,
  currentUser,
  mode,
  recipientUserId,
}: {
  body: string
  classSectionId: string | null
  currentUser: Awaited<ReturnType<typeof requireAuth>>
  mode: "DIRECT" | "PARENT_TEACHER"
  recipientUserId: string | null
}) {
  if (!recipientUserId) throw new Error("Choose a recipient.")

  const prisma = getPrismaClient()
  const recipient = await prisma.user.findUnique({
    where: { id: recipientUserId },
    include: { roleAssignments: true },
  })
  if (!recipient) throw new Error("Recipient not found.")

  const roles = new Set(currentUser.roleAssignments.map((item) => item.role))
  const recipientRoles = new Set(recipient.roleAssignments.map((item) => item.role))
  let allowed = false

  if (mode === "PARENT_TEACHER") {
    const parentId = roles.has(UserRole.PARENT) ? currentUser.id : recipient.id
    const teacherId = roles.has(UserRole.PARENT) ? recipient.id : currentUser.id
    allowed = Boolean(
      await canParentMessageTeacher(parentId, teacherId, classSectionId)
    )
  } else if (roles.has(UserRole.STUDENT)) {
    if (recipientRoles.has(UserRole.STUDENT)) {
      throw new Error("Student-to-student messaging is disabled.")
    }
    allowed = await canStudentMessageTeacher(
      currentUser.id,
      recipientUserId,
      classSectionId
    )
  } else if (recipientRoles.has(UserRole.STUDENT)) {
    allowed = await canTeacherMessageStudent(
      currentUser.id,
      recipientUserId,
      classSectionId
    )
  } else {
    allowed = isStaffLike(currentUser) || isTeacherLike(currentUser)
  }

  if (!allowed) {
    throw new Error("You are not allowed to message this recipient.")
  }

  const classSection = classSectionId
    ? await prisma.classSection.findUnique({
        where: { id: classSectionId },
        include: { course: true },
      })
    : null

  const organizationId = classSection?.organizationId ?? currentUser.roleAssignments[0]?.organizationId
  if (!organizationId) throw new Error("Organization scope is required.")

  const conversation =
    (await prisma.conversation.findFirst({
      where: {
        type: ConversationType.DIRECT,
        classSectionId: classSectionId || null,
        participants: {
          every: { userId: { in: [currentUser.id, recipientUserId] } },
        },
        AND: [
          { participants: { some: { userId: currentUser.id } } },
          { participants: { some: { userId: recipientUserId } } },
        ],
      },
    })) ??
    (await prisma.conversation.create({
      data: {
        organizationId,
        campusId: classSection?.campusId,
        classSectionId: classSection?.id,
        type: ConversationType.DIRECT,
        title:
          mode === "PARENT_TEACHER"
            ? `Parent-teacher: ${classSection?.course.title ?? "Class"}`
            : null,
        participants: {
          create: [
            { userId: currentUser.id, lastReadAt: new Date() },
            { userId: recipientUserId },
          ],
        },
      },
    }))

  await ensureParticipant(conversation.id, currentUser.id)
  await ensureParticipant(conversation.id, recipientUserId)
  await addMessage(conversation.id, organizationId, currentUser.id, body)
  return conversation
}

async function createOrOpenClassGroup(
  userId: string,
  classSectionId: string | null,
  initialBody: string
) {
  if (!classSectionId) throw new Error("Choose a class section.")
  if (!(await canManageClassSection(userId, classSectionId))) {
    throw new Error("Only assigned instructors or admins can create class groups.")
  }

  const prisma = getPrismaClient()
  const classSection = await prisma.classSection.findUniqueOrThrow({
    where: { id: classSectionId },
    include: {
      course: true,
      enrollments: true,
      instructors: true,
    },
  })
  const conversation =
    (await prisma.conversation.findFirst({
      where: { classSectionId, type: ConversationType.CLASS_SECTION },
    })) ??
    (await prisma.conversation.create({
      data: {
        organizationId: classSection.organizationId,
        campusId: classSection.campusId,
        classSectionId,
        type: ConversationType.CLASS_SECTION,
        title: `${classSection.course.title} class group`,
      },
    }))

  const participantIds = new Set<string>([
    ...classSection.instructors.map((item) => item.instructorId),
    ...classSection.enrollments.map((item) => item.studentId),
  ])
  participantIds.add(userId)

  await Promise.all(
    Array.from(participantIds).map((participantId) =>
      ensureParticipant(conversation.id, participantId)
    )
  )

  if (!(await hasMessages(conversation.id))) {
    await addMessage(
      conversation.id,
      classSection.organizationId,
      userId,
      initialBody
    )
  }

  return conversation
}

async function ensureParticipant(conversationId: string, userId: string) {
  await getPrismaClient().conversationParticipant.upsert({
    where: { conversationId_userId: { conversationId, userId } },
    update: {},
    create: { conversationId, userId },
  })
}

async function addMessage(
  conversationId: string,
  organizationId: string,
  senderId: string,
  body: string
) {
  const prisma = getPrismaClient()
  await prisma.message.create({
    data: { conversationId, organizationId, senderId, body },
  })
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  })
  await markConversationRead(conversationId, senderId)

  const [sender, participants] = await Promise.all([
    prisma.user.findUnique({
      where: { id: senderId },
      select: { email: true, name: true },
    }),
    prisma.conversationParticipant.findMany({
      where: { conversationId },
      select: { userId: true },
    }),
  ])

  await createNotificationsForUsers(
    participants.map((participant) => participant.userId),
    {
      actionUrl: `/messages/${conversationId}`,
      actorUserId: senderId,
      body: truncatePreview(body),
      entityId: conversationId,
      entityType: "Conversation",
      title: `New message from ${sender?.name ?? sender?.email ?? "Someone"}`,
      type: NotificationType.NEW_MESSAGE,
    }
  )
}

async function markConversationRead(conversationId: string, userId: string) {
  await getPrismaClient().conversationParticipant.update({
    where: { conversationId_userId: { conversationId, userId } },
    data: { lastReadAt: new Date() },
  })
}

async function hasMessages(conversationId: string) {
  const count = await getPrismaClient().message.count({
    where: { conversationId },
  })
  return count > 0
}

function isTeacherLike(user: Awaited<ReturnType<typeof requireAuth>>) {
  const roles = new Set<UserRole>([
    UserRole.INSTRUCTOR,
    UserRole.HOMEROOM_TEACHER,
  ])

  return user.roleAssignments.some((item) => roles.has(item.role))
}

function isStaffLike(user: Awaited<ReturnType<typeof requireAuth>>) {
  const roles = new Set<UserRole>([
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.SCHOOL_ADMIN,
    UserRole.ACADEMIC_STAFF,
  ])

  return user.roleAssignments.some((item) => roles.has(item.role))
}

function parseRecipientUserId(value: string | null) {
  if (!value) return null

  const parts = value.split(":")
  if (parts.length >= 3) return parts[1] ?? null

  return value
}

function truncatePreview(value: string) {
  return value.length > 120 ? `${value.slice(0, 117)}...` : value
}
