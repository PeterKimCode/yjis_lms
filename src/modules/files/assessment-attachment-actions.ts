"use server"
import { UserRole } from "@prisma/client"
import { revalidatePath } from "next/cache"
import { getPrismaClient } from "@/lib/prisma"
import {
  canManageClassSection,
  requireAnyRole
} from "@/modules/auth/permissions"
import { uploadClassPdfAttachment } from "./pdf-upload"
import type { QuizActionState } from "@/modules/quizzes/action-state"
export async function manageAssessmentAttachment(
  _: QuizActionState,
  form: FormData
): Promise<QuizActionState> {
  const user = await requireAnyRole([
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.SCHOOL_ADMIN,
    UserRole.ACADEMIC_STAFF,
    UserRole.INSTRUCTOR,
    UserRole.HOMEROOM_TEACHER
  ])
  const kind = String(form.get("kind")),
    ownerId = String(form.get("ownerId")),
    fileAssetId = String(form.get("fileAssetId")),
    operation = String(form.get("operation"))
  if (
    !["assignment", "quiz"].includes(kind) ||
    !["replace", "delete"].includes(operation)
  )
    return { ok: false, message: "Invalid attachment action." }
  const db = getPrismaClient()
  const owner =
    kind === "assignment"
      ? await db.assignment.findUnique({
          where: { id: ownerId },
          include: { attachments: true }
        })
      : await db.quiz.findFirst({
          where: { id: ownerId, archivedAt: null },
          include: { attachments: true }
        })
  if (
    !owner ||
    !owner.attachments.some((a) => a.fileAssetId === fileAssetId) ||
    !(await canManageClassSection(user.id, owner.classSectionId))
  )
    return {
      ok: false,
      message: "Attachment was not found or access was denied."
    }
  try {
    let replacementId: string | null = null
    if (operation === "replace") {
      const file = form.get("replacementFile")
      if (!(file instanceof File) || !file.size)
        return { ok: false, message: "Choose a replacement PDF." }
      const asset = await uploadClassPdfAttachment({
        actorUserId: user.id,
        classSectionId: owner.classSectionId,
        organizationId: owner.organizationId,
        file,
        prefix: kind === "assignment" ? "assignments" : "quizzes"
      })
      replacementId = asset.id
    }
    await db.$transaction(async (tx) => {
      if (kind === "assignment") {
        const where = { assignmentId: ownerId, fileAssetId }
        const count = replacementId
          ? await tx.assignmentAttachment.updateMany({
              where,
              data: { fileAssetId: replacementId }
            })
          : await tx.assignmentAttachment.deleteMany({ where })
        if (count.count !== 1)
          throw new Error("Attachment changed. Refresh and retry.")
      } else {
        const where = { quizId: ownerId, fileAssetId }
        const count = replacementId
          ? await tx.quizAttachment.updateMany({
              where,
              data: { fileAssetId: replacementId }
            })
          : await tx.quizAttachment.deleteMany({ where })
        if (count.count !== 1)
          throw new Error("Attachment changed. Refresh and retry.")
        if (replacementId)
          await tx.examAttachment.updateMany({
            where: { fileAssetId, exam: { quizId: ownerId } },
            data: { fileAssetId: replacementId }
          })
        else
          await tx.examAttachment.deleteMany({
            where: { fileAssetId, exam: { quizId: ownerId } }
          })
      }
    })
    revalidatePath(`/instructor/classes/${owner.classSectionId}`)
    revalidatePath(`/student/classes/${owner.classSectionId}`)
    revalidatePath(
      `/instructor/classes/${owner.classSectionId}/quizzes/${ownerId}`
    )
    return {
      ok: true,
      message: operation === "replace" ? "PDF replaced." : "Attachment removed."
    }
  } catch (error) {
    return {
      ok: false,
      message: `${error instanceof Error ? error.message : "Upload failed."} The existing attachment was kept. Choose the PDF again to retry.`
    }
  }
}
