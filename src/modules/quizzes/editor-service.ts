import "server-only"
import { Prisma, UserRole } from "@prisma/client"
import { z } from "zod"
import { revalidatePath } from "next/cache"
import { getPrismaClient } from "@/lib/prisma"
import { parseDateTimeLocalInTimeZone } from "@/lib/timezone"
import {
  requireAnyRole,
  canManageClassSection
} from "@/modules/auth/permissions"
import { uploadClassPdfAttachment } from "@/modules/files/pdf-upload"
import { notifyClassStudents } from "@/modules/notifications/service"
import { NotificationType } from "@prisma/client"
import { validateEditorQuestions } from "./editor-validation"
import type { QuizActionState } from "./action-state"
const optionalNumber = (integer = false) =>
  z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    (integer
      ? z.coerce.number().int().min(1)
      : z.coerce.number().min(0).max(999999.99)
    ).optional()
  )
const schema = z.object({
  title: z.string().trim().min(1, "Enter a title."),
  classSectionId: z.string().min(1),
  timeLimitMinutes: optionalNumber(true),
  maxAttempts: optionalNumber(true),
  pointsPossible: optionalNumber()
})

export async function saveEditorQuiz(form: FormData): Promise<QuizActionState> {
  const parsed = schema.safeParse(Object.fromEntries(form))
  if (!parsed.success)
    return {
      ok: false,
      message: "Check the highlighted fields.",
      fieldErrors: Object.fromEntries(
        parsed.error.issues.map((issue) => [
          String(issue.path[0]),
          issue.message
        ])
      )
    }
  const data = parsed.data,
    id = String(form.get("id") ?? ""),
    publish = form.get("isPublished") === "on"
  let input: unknown
  try {
    input = JSON.parse(String(form.get("editorQuestions")))
  } catch {
    return { ok: false, message: "Invalid questions." }
  }
  const validated = validateEditorQuestions(input, publish)
  if (!validated.ok)
    return {
      ok: false,
      message: "Check the highlighted questions.",
      fieldErrors: validated.errors
    }
  const user = await requireAnyRole([
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.SCHOOL_ADMIN,
    UserRole.ACADEMIC_STAFF,
    UserRole.INSTRUCTOR,
    UserRole.HOMEROOM_TEACHER
  ])
  if (!(await canManageClassSection(user.id, data.classSectionId)))
    return { ok: false, message: "You cannot edit quizzes in this class." }
  const db = getPrismaClient()
  const section = await db.classSection.findUniqueOrThrow({
    where: { id: data.classSectionId },
    include: { organization: { select: { timezone: true } } }
  })
  let opensAt: Date | null, closesAt: Date | null
  try {
    opensAt = parseDateTimeLocalInTimeZone(
      String(form.get("opensAt") ?? "") || null,
      section.organization.timezone
    )
    closesAt = parseDateTimeLocalInTimeZone(
      String(form.get("closesAt") ?? "") || null,
      section.organization.timezone
    )
  } catch {
    return {
      ok: false,
      message: "Enter valid dates.",
      fieldErrors: {
        opensAt: "Enter a valid date.",
        closesAt: "Enter a valid date."
      }
    }
  }
  if (opensAt && closesAt && opensAt >= closesAt)
    return {
      ok: false,
      message: "Closing time must be after opening time.",
      fieldErrors: { closesAt: "Choose a time after the opening time." }
    }
  let saved: { id: string; newlyPublished: boolean }
  try {
    saved = await db.$transaction(
      async (tx) => {
        const previous = id
          ? await tx.quiz.findFirst({
              where: { id, classSectionId: data.classSectionId },
              include: {
                questions: { include: { options: true } },
                _count: { select: { attempts: true } }
              }
            })
          : null
        if (id && !previous)
          throw new Error("Quiz was not found in this class.")
        const attempted = Boolean(previous?._count.attempts)
        const incomingIds = validated.questions.flatMap((question) =>
          question.id ? [question.id] : []
        )
        if (
          incomingIds.some(
            (qid) =>
              !previous?.questions.some((question) => question.id === qid)
          )
        )
          throw new Error("A question does not belong to this quiz.")
        if (
          attempted &&
          (validated.questions.length !== previous!.questions.length ||
            validated.questions.some((question) => !question.id))
        )
          throw new Error(
            "Questions cannot be added or removed after students start this quiz."
          )
        const quiz = previous
          ? await tx.quiz.update({
              where: { id },
              data: {
                title: data.title,
                description: String(form.get("description") ?? "") || null,
                opensAt,
                closesAt,
                timeLimitMinutes: data.timeLimitMinutes ?? null,
                maxAttempts: data.maxAttempts ?? 1,
                pointsPossible:
                  data.pointsPossible === undefined
                    ? null
                    : new Prisma.Decimal(data.pointsPossible),
                isPublished: publish,
                showResultsToStudents: form.has("showResultsToStudents")
              }
            })
          : await tx.quiz.create({
              data: {
                organizationId: section.organizationId,
                classSectionId: section.id,
                title: data.title,
                description: String(form.get("description") ?? "") || null,
                opensAt,
                closesAt,
                timeLimitMinutes: data.timeLimitMinutes ?? null,
                maxAttempts: data.maxAttempts ?? 1,
                pointsPossible:
                  data.pointsPossible === undefined
                    ? null
                    : new Prisma.Decimal(data.pointsPossible),
                isPublished: publish,
                showResultsToStudents: form.has("showResultsToStudents"),
                shuffleQuestions: false
              }
            })
        for (const [index, question] of validated.questions.entries()) {
          const old = previous?.questions.find(
            (item) => item.id === question.id
          )
          const options = question.options.filter((option) =>
            option.text.trim()
          )
          if (
            options.some(
              (option) =>
                option.id && !old?.options.some((item) => item.id === option.id)
            )
          )
            throw new Error("An answer does not belong to this question.")
          if (
            attempted &&
            old &&
            (old.type !== question.type ||
              Number(old.points) !== question.points ||
              (question.type === "MULTIPLE_CHOICE" &&
                (old.options.length !== options.length ||
                  options.some(
                    (option) =>
                      !old.options.some(
                        (item) =>
                          item.id === option.id &&
                          item.text === option.text &&
                          item.isCorrect === option.isCorrect
                      )
                  ))) ||
              (question.type === "TRUE_FALSE" &&
                (old.answerKey as { correctBoolean?: boolean } | null)
                  ?.correctBoolean !== question.correctBoolean) ||
              (question.type === "SHORT_ANSWER" &&
                JSON.stringify(
                  (old.answerKey as { acceptedAnswers?: string[] } | null)
                    ?.acceptedAnswers ?? []
                ) !==
                  JSON.stringify(
                    question.acceptedAnswers
                      .split("\n")
                      .map((value) => value.trim())
                      .filter(Boolean)
                  )))
          )
            throw new Error(
              "Answer types, answers and points cannot change after students start the quiz."
            )
          const answerKey =
            question.type === "MULTIPLE_CHOICE"
              ? {
                  correctOptionIndex: options.findIndex(
                    (option) => option.isCorrect
                  )
                }
              : question.type === "TRUE_FALSE"
                ? { correctBoolean: question.correctBoolean! }
                : question.type === "SHORT_ANSWER"
                  ? {
                      acceptedAnswers: question.acceptedAnswers
                        .split("\n")
                        .map((value) => value.trim())
                        .filter(Boolean)
                    }
                  : Prisma.JsonNull
          const rubric =
            old?.rubric &&
            typeof old.rubric === "object" &&
            !Array.isArray(old.rubric)
              ? old.rubric
              : {}
          const values = {
            type: question.type,
            prompt: question.prompt,
            points: new Prisma.Decimal(question.points),
            sequence: index + 1,
            answerKey,
            rubric: { ...rubric, explanation: question.explanation }
          }
          const record = old
            ? await tx.question.update({ where: { id: old.id }, data: values })
            : await tx.question.create({
                data: {
                  ...values,
                  organizationId: section.organizationId,
                  quizId: quiz.id
                }
              })
          if (question.type === "MULTIPLE_CHOICE") {
            for (const [position, option] of options.entries()) {
              const values = {
                text: option.text.trim(),
                isCorrect: option.isCorrect,
                sequence: position + 1
              }
              if (option.id)
                await tx.questionOption.update({
                  where: { id: option.id },
                  data: values
                })
              else
                await tx.questionOption.create({
                  data: { ...values, questionId: record.id }
                })
            }
            await tx.questionOption.deleteMany({
              where: {
                questionId: record.id,
                id: {
                  in: (old?.options ?? [])
                    .filter(
                      (option) => !options.some((item) => item.id === option.id)
                    )
                    .map((option) => option.id)
                }
              }
            })
          } else if (!attempted)
            await tx.questionOption.deleteMany({
              where: { questionId: record.id }
            })
        }
        if (previous && !attempted)
          await tx.question.deleteMany({
            where: {
              quizId: quiz.id,
              id: {
                in: previous.questions
                  .filter((question) => !incomingIds.includes(question.id))
                  .map((question) => question.id)
              }
            }
          })
        return {
          id: quiz.id,
          newlyPublished: publish && !previous?.isPublished
        }
      },
      { isolationLevel: "Serializable" }
    )
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Could not save the quiz. Please try again."
    }
  }
  revalidatePath(`/instructor/classes/${section.id}`)
  revalidatePath(`/instructor/classes/${section.id}/quizzes/${saved.id}`)
  revalidatePath(`/student/classes/${section.id}`)
  if (saved.newlyPublished)
    try {
      await notifyClassStudents(section.id, {
        actorUserId: user.id,
        actionUrl: `/student/classes/${section.id}`,
        entityId: saved.id,
        entityType: "Quiz",
        title: `New quiz: ${data.title}`,
        type: NotificationType.NEW_QUIZ
      })
    } catch {
      console.error(
        "Quiz saved, but publication notifications could not be sent",
        { quizId: saved.id }
      )
    }
  const pdf = form.get("pdfAttachmentFile")
  if (pdf instanceof File && pdf.size) {
    try {
      const asset = await uploadClassPdfAttachment({
        actorUserId: user.id,
        classSectionId: section.id,
        organizationId: section.organizationId,
        file: pdf,
        prefix: "quizzes"
      })
      await db.quizAttachment.create({
        data: { quizId: saved.id, fileAssetId: asset.id }
      })
      revalidatePath(`/instructor/classes/${section.id}/quizzes/${saved.id}`)
    } catch {
      return {
        ok: false,
        saved: true,
        quizId: saved.id,
        message:
          "Quiz saved. PDF upload failed. Choose the PDF again and retry; the quiz will not be duplicated.",
        fieldErrors: { pdfAttachmentFile: "PDF upload failed. Please retry." }
      }
    }
  }
  return { ok: true, saved: true, quizId: saved.id, message: "Quiz saved." }
}
