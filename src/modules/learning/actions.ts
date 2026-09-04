"use server"

import { revalidatePath } from "next/cache"
import { LessonContentType, UserRole, VideoProvider } from "@prisma/client"
import { z } from "zod"

import { getPrismaClient } from "@/lib/prisma"
import {
  canManageClassSection,
  canViewClassSection,
  requireAnyRole,
} from "@/modules/auth/permissions"
import type { LessonActionState } from "@/modules/learning/action-state"
import { isYouTubeUrl } from "@/modules/learning/video"
import {
  LessonVideoUploadError,
  uploadLessonVideoFile,
} from "@/modules/learning/video-upload-service"
import { resolvePolicies } from "@/modules/policies/resolve"

const optionalString = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() : ""),
  z.string().transform((value) => (value.length ? value : null))
)
const requiredString = z.string().trim().min(1)
const optionalInt = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.coerce.number().int().min(0).optional().nullable().transform((value) => value ?? null)
)
const optionalSequence = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.coerce.number().int().min(1).optional()
)

const lessonSchema = z.object({
  id: optionalString,
  classSectionId: requiredString,
  title: requiredString,
  description: optionalString,
  sequence: optionalSequence,
  contentType: z.nativeEnum(LessonContentType),
  videoProvider: z.nativeEnum(VideoProvider).optional().default(VideoProvider.HTML5),
  videoUrl: optionalString,
  videoFileAssetId: optionalString,
  durationSeconds: optionalInt,
  isPublished: z.boolean(),
}).superRefine((data, context) => {
  if (
    !data.id &&
    data.contentType !== LessonContentType.TEXT &&
    data.contentType !== LessonContentType.VIDEO &&
    data.contentType !== LessonContentType.FILE
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "New lessons can be Text, Video, or File.",
      path: ["contentType"],
    })
    return
  }

  if (data.contentType === LessonContentType.FILE) {
    if (!data.videoFileAssetId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "File lessons require an uploaded PDF, PPT, document, or image file.",
        path: ["videoFileAssetId"],
      })
    }
    return
  }

  if (data.contentType !== LessonContentType.VIDEO) {
    return
  }

  if (data.videoProvider === VideoProvider.YOUTUBE) {
    if (!data.videoUrl || !isYouTubeUrl(data.videoUrl)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "YouTube lessons require a valid YouTube URL.",
        path: ["videoUrl"],
      })
    }
    return
  }

  if (!data.videoUrl && !data.videoFileAssetId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Uploaded video lessons require a selected uploaded video file.",
      path: ["videoFileAssetId"],
    })
    return
  }

  if (data.videoUrl && isYouTubeUrl(data.videoUrl)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Select YouTube as the provider for YouTube URLs.",
      path: ["videoProvider"],
    })
  }
})

export async function saveLesson(
  _previousState: LessonActionState,
  formData: FormData
): Promise<LessonActionState> {
  const instructor = await requireAnyRole([
    UserRole.INSTRUCTOR,
    UserRole.HOMEROOM_TEACHER,
  ])
  const parsed = lessonSchema.safeParse({
    id: formData.get("id") ?? "",
    classSectionId: formData.get("classSectionId") ?? "",
    title: formData.get("title") ?? "",
    description: formData.get("description") ?? "",
    sequence: formData.get("sequence") ?? "",
    contentType: formData.get("contentType") ?? LessonContentType.TEXT,
    videoProvider: formData.get("videoProvider") ?? VideoProvider.HTML5,
    videoUrl: formData.get("videoUrl") ?? "",
    videoFileAssetId: formData.get("videoFileAssetId") ?? "",
    durationSeconds: formData.get("durationSeconds") ?? "",
    isPublished: formData.get("isPublished") === "on",
  })

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Please check the lesson form.",
    }
  }

  const data = parsed.data

  if (!(await canManageClassSection(instructor.id, data.classSectionId))) {
    throw new Error("Forbidden")
  }

  const prisma = getPrismaClient()
  const classSection = await prisma.classSection.findUniqueOrThrow({
    where: { id: data.classSectionId },
    select: { organizationId: true },
  })
  const selectedFile = data.videoFileAssetId
    ? await prisma.fileAsset.findFirst({
        where: {
          id: data.videoFileAssetId,
          organizationId: classSection.organizationId,
          OR: [
            { classSectionId: data.classSectionId },
            { classSectionId: null },
          ],
        },
        select: { id: true },
      })
    : null

  if (data.videoFileAssetId && !selectedFile) {
    return {
      ok: false,
      message: "Selected file is not available for this class section.",
    }
  }

  const { id, ...values } = data
  const sequence =
    values.sequence ??
    ((await prisma.lesson.aggregate({
      where: { classSectionId: data.classSectionId },
      _max: { sequence: true },
    }))._max.sequence ?? 0) + 1
  const lessonValues =
    values.contentType === LessonContentType.VIDEO
      ? {
          ...values,
          sequence,
          videoFileAssetId:
            values.videoProvider === VideoProvider.YOUTUBE
              ? null
              : values.videoFileAssetId,
        }
      : values.contentType === LessonContentType.FILE
        ? {
            ...values,
            sequence,
            videoProvider: VideoProvider.HTML5,
            videoUrl: null,
            durationSeconds: null,
          }
      : {
          ...values,
          sequence,
          videoProvider: VideoProvider.HTML5,
          videoUrl: null,
          videoFileAssetId: null,
          durationSeconds: null,
        }

  if (id) {
    await prisma.lesson.update({
      where: { id },
      data: lessonValues,
    })
  } else {
    await prisma.lesson.create({
      data: {
        ...lessonValues,
        organizationId: classSection.organizationId,
        createdById: instructor.id,
      },
    })
  }

  revalidatePath(`/instructor/classes/${data.classSectionId}`)
  return {
    ok: true,
    message: id ? "Lesson saved." : "Lesson created.",
  }
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

export async function uploadLessonVideo(
  _previousState: LessonActionState,
  formData: FormData
): Promise<LessonActionState> {
  const instructor = await requireAnyRole([
    UserRole.INSTRUCTOR,
    UserRole.HOMEROOM_TEACHER,
  ])
  const classSectionId = String(formData.get("classSectionId") ?? "")
  const file = formData.get("videoFile")

  if (!(await canManageClassSection(instructor.id, classSectionId))) {
    throw new Error("Forbidden")
  }

  if (!(file instanceof File)) {
    return { ok: false, message: "Choose a video file to upload." }
  }

  try {
    const fileAsset = await uploadLessonVideoFile({
      classSectionId,
      file,
      instructorId: instructor.id,
    })

    revalidatePath(`/instructor/classes/${classSectionId}`)
    return {
      ok: true,
      message: "Video uploaded. You can now select it from Uploaded video file.",
      uploadedVideoFileAssetId: fileAsset.id,
      uploadedVideoFileLabel: fileAsset.originalName,
    }
  } catch (error) {
    if (error instanceof LessonVideoUploadError) {
      return { ok: false, message: error.message }
    }
    console.error("Lesson video upload failed", {
      classSectionId,
      error: error instanceof Error ? error.message : String(error),
    })
    return { ok: false, message: "Video upload failed. Please try again." }
  }
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
      classSection: {
        select: {
          id: true,
          campusId: true,
        },
      },
    },
  })
  const threshold = await getCompletionThreshold({
    organizationId: lesson.organizationId,
    campusId: lesson.classSection.campusId,
    classSectionId: lesson.classSection.id,
  })
  const durationSeconds =
    data.durationSeconds || lesson.durationSeconds || data.lastPositionSeconds || 0
  const existing = await getPrismaClient().videoProgress.findFirst({
    where: {
      lessonId: data.lessonId,
      studentId: student.id,
    },
  })
  const watchedSeconds = Math.max(
    existing?.watchedSeconds ?? 0,
    data.watchedSeconds
  )
  const progressRate =
    durationSeconds > 0
      ? Math.min(100, (watchedSeconds / durationSeconds) * 100)
      : 0
  const completed = progressRate >= threshold
  const now = new Date()
  const values = {
    organizationId: lesson.organizationId,
    lessonId: data.lessonId,
    studentId: student.id,
    watchedSeconds,
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

export async function markLessonViewed(input: {
  classSectionId: string
  lessonId: string
}) {
  const student = await requireAnyRole([UserRole.STUDENT])

  if (!(await canViewClassSection(student.id, input.classSectionId))) {
    throw new Error("Forbidden")
  }

  const lesson = await getPrismaClient().lesson.findFirstOrThrow({
    where: {
      id: input.lessonId,
      classSectionId: input.classSectionId,
      isPublished: true,
    },
    select: {
      contentType: true,
      organizationId: true,
    },
  })

  if (lesson.contentType === LessonContentType.VIDEO) {
    return
  }

  const existing = await getPrismaClient().videoProgress.findFirst({
    where: {
      lessonId: input.lessonId,
      studentId: student.id,
    },
  })
  const now = new Date()
  const values = {
    organizationId: lesson.organizationId,
    lessonId: input.lessonId,
    studentId: student.id,
    watchedSeconds: 0,
    durationSeconds: 0,
    totalSeconds: 0,
    progressRate: "100.00",
    percentComplete: "100.00",
    completed: true,
    completedAt: existing?.completedAt ?? now,
    lastPositionSeconds: 0,
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
}

async function getCompletionThreshold(input: {
  organizationId: string
  campusId?: string | null
  classSectionId?: string | null
}) {
  const policies = await resolvePolicies(input)
  return policies.videoCompletion.completionThresholdPercent
}
