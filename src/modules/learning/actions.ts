"use server"

import { revalidatePath } from "next/cache"
import { LessonContentType, UserRole } from "@prisma/client"
import { z } from "zod"

import { getPrismaClient } from "@/lib/prisma"
import {
  canManageClassSection,
  canViewClassSection,
  requireAnyRole,
} from "@/modules/auth/permissions"

const optionalString = z
  .string()
  .trim()
  .transform((value) => (value.length ? value : null))
const requiredString = z.string().trim().min(1)
const optionalInt = optionalString.transform((value) =>
  value === null ? null : Number.parseInt(value, 10)
)
const checkboxBoolean = z
  .union([z.literal("on"), z.null()])
  .transform((value) => value === "on")

const lessonSchema = z.object({
  id: optionalString,
  classSectionId: requiredString,
  title: requiredString,
  description: optionalString,
  sequence: z.coerce.number().int().min(1),
  contentType: z.nativeEnum(LessonContentType),
  videoUrl: optionalString,
  videoFileAssetId: optionalString,
  durationSeconds: optionalInt,
  isPublished: checkboxBoolean,
})

export async function saveLesson(formData: FormData) {
  const instructor = await requireAnyRole([
    UserRole.INSTRUCTOR,
    UserRole.HOMEROOM_TEACHER,
  ])
  const data = lessonSchema.parse({
    ...Object.fromEntries(formData.entries()),
    isPublished: formData.get("isPublished"),
  })

  if (!(await canManageClassSection(instructor.id, data.classSectionId))) {
    throw new Error("Forbidden")
  }

  const classSection = await getPrismaClient().classSection.findUniqueOrThrow({
    where: { id: data.classSectionId },
    select: { organizationId: true },
  })
  const { id, ...values } = data

  if (id) {
    await getPrismaClient().lesson.update({
      where: { id },
      data: values,
    })
  } else {
    await getPrismaClient().lesson.create({
      data: {
        ...values,
        organizationId: classSection.organizationId,
        createdById: instructor.id,
      },
    })
  }

  revalidatePath(`/instructor/classes/${data.classSectionId}`)
}

export async function deleteLesson(formData: FormData) {
  const instructor = await requireAnyRole([
    UserRole.INSTRUCTOR,
    UserRole.HOMEROOM_TEACHER,
  ])
  const lessonId = String(formData.get("lessonId") ?? "")
  const lesson = await getPrismaClient().lesson.findUniqueOrThrow({
    where: { id: lessonId },
    select: { classSectionId: true },
  })

  if (!(await canManageClassSection(instructor.id, lesson.classSectionId))) {
    throw new Error("Forbidden")
  }

  await getPrismaClient().lesson.delete({ where: { id: lessonId } })
  revalidatePath(`/instructor/classes/${lesson.classSectionId}`)
}

const progressSchema = z.object({
  classSectionId: requiredString,
  lessonId: requiredString,
  watchedSeconds: z.coerce.number().int().min(0),
  durationSeconds: z.coerce.number().int().min(0),
  lastPositionSeconds: z.coerce.number().int().min(0),
})

export async function saveVideoProgress(input: z.input<typeof progressSchema>) {
  const student = await requireAnyRole([UserRole.STUDENT])
  const data = progressSchema.parse(input)

  if (!(await canViewClassSection(student.id, data.classSectionId))) {
    throw new Error("Forbidden")
  }

  const lesson = await getPrismaClient().lesson.findFirstOrThrow({
    where: {
      id: data.lessonId,
      classSectionId: data.classSectionId,
      isPublished: true,
    },
    select: {
      organizationId: true,
      durationSeconds: true,
    },
  })
  const threshold = await getCompletionThreshold(lesson.organizationId)
  const durationSeconds =
    data.durationSeconds || lesson.durationSeconds || data.lastPositionSeconds || 0
  const progressRate =
    durationSeconds > 0
      ? Math.min(100, (data.watchedSeconds / durationSeconds) * 100)
      : 0
  const completed = progressRate >= threshold
  const existing = await getPrismaClient().videoProgress.findFirst({
    where: {
      lessonId: data.lessonId,
      studentId: student.id,
    },
  })
  const now = new Date()
  const values = {
    organizationId: lesson.organizationId,
    lessonId: data.lessonId,
    studentId: student.id,
    watchedSeconds: data.watchedSeconds,
    durationSeconds,
    totalSeconds: durationSeconds,
    progressRate: progressRate.toFixed(2),
    percentComplete: progressRate.toFixed(2),
    completed,
    completedAt: completed ? existing?.completedAt ?? now : null,
    lastPositionSeconds: data.lastPositionSeconds,
    lastWatchedAt: now,
  }

  if (existing) {
    await getPrismaClient().videoProgress.update({
      where: { id: existing.id },
      data: values,
    })
  } else {
    await getPrismaClient().videoProgress.create({
      data: values,
    })
  }

  return { progressRate, completed }
}

async function getCompletionThreshold(organizationId: string) {
  const policy = await getPrismaClient().videoCompletionPolicy.findFirst({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    select: { requiredPercentage: true },
  })

  return Number(policy?.requiredPercentage ?? 90)
}
