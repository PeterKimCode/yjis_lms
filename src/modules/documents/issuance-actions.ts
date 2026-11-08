"use server"

import { randomUUID } from "node:crypto"
import { Prisma } from "@prisma/client"
import { revalidatePath } from "next/cache"
import { getPrismaClient } from "@/lib/prisma"
import { requireAnyRole } from "@/modules/auth/permissions"
import { documentTitle, getStudentDocumentTerms, IssuanceError, issuanceScope, issuerRoles, renderIssuance, requestSummary } from "./issuance"

type ActionState = { ok: boolean; message: string }

function actionFailure(error: unknown, fallback: string): ActionState {
  if (error instanceof IssuanceError) return { ok: false, message: error.message }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
    return { ok: false, message: "The request changed while you were working. Refresh and try again." }
  }
  console.error("Grade document action failed", error instanceof Error ? error.name : "Unknown error")
  return { ok: false, message: fallback }
}

export async function requestGradeDocument(_: ActionState, form: FormData): Promise<ActionState> {
  const user = await requireAnyRole(["STUDENT"])
  const documentType = form.get("documentType")
  if (documentType !== "REPORT_CARD" && documentType !== "TRANSCRIPT") {
    return { ok: false, message: "Choose a document type." }
  }
  const termId = String(form.get("termId") ?? "")
  try {
    await getPrismaClient().$transaction(async (tx) => {
      const student = await tx.studentProfile.findUnique({ where: { userId: user.id } })
      if (!student) throw new IssuanceError("Your student profile is unavailable. Contact the school office.")
      const term = documentType === "REPORT_CARD"
        ? (await getStudentDocumentTerms(user.id, tx)).find((option) => option.id === termId)
        : null
      if (documentType === "REPORT_CARD" && !term) throw new IssuanceError("Select one of your enrolled terms.")
      const request = await tx.gradeDocumentRequest.create({
        data: {
          studentId: user.id, documentType, termId: term?.id,
          termLabel: term ? `${term.academicYear.name} · ${term.name} · ${term.organization.name}` : null,
          pendingKey: term ? `report-card:${term.id}` : "transcript",
        },
        select: { id: true },
      })
      await tx.auditLog.create({
        data: {
          actorUserId: user.id, organizationId: student.organizationId, campusId: student.campusId,
          entityType: "GradeDocumentRequest", entityId: request.id, action: "grade_document.request",
        },
      })
    })
    revalidatePath("/student")
    revalidatePath("/admin/grades-documents")
    return { ok: true, message: "Request sent to your school." }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, message: "You already have a pending request for this document." }
    }
    return actionFailure(error, "Could not send the request. Try again.")
  }
}

export async function prepareGradeDocument(_: ActionState, form: FormData): Promise<ActionState> {
  return processGradeDocument(form, "preview")
}

export async function reviewGradeDocument(_: ActionState, form: FormData): Promise<ActionState> {
  const decision = form.get("decision")
  if (decision !== "approve" && decision !== "reject") return { ok: false, message: "Choose a decision." }
  return processGradeDocument(form, decision)
}

async function processGradeDocument(form: FormData, decision: "preview" | "approve" | "reject"): Promise<ActionState> {
  const admin = await requireAnyRole([...issuerRoles])
  const id = String(form.get("requestId") ?? "")
  const reason = String(form.get("reason") ?? "").trim()
  const token = String(form.get("previewToken") ?? "")
  if (decision === "reject" && (!reason || reason.length > 1000)) {
    return { ok: false, message: "Enter a rejection reason of 1–1000 characters." }
  }
  try {
    await getPrismaClient().$transaction(async (tx) => {
      const request = await tx.gradeDocumentRequest.findFirst({
        where: { id, status: "PENDING", student: issuanceScope(admin.roleAssignments) },
        select: {
          ...requestSummary, previewById: true, previewToken: true, previewFingerprint: true, filename: true,
          student: { select: { studentProfile: { select: { organizationId: true, campusId: true } } } },
        },
      })
      const scope = request?.student.studentProfile
      if (!request || !scope) throw new IssuanceError("This pending request is no longer available to you.")
      if (decision === "preview") {
        const document = await renderIssuance(tx, request)
        await tx.gradeDocumentRequest.update({
          where: { id, status: "PENDING" },
          data: {
            previewById: admin.id, previewToken: randomUUID(), previewFingerprint: document.fingerprint,
            pdf: new Uint8Array(document.pdf), filename: document.filename,
          },
        })
        return
      }
      if (decision === "approve") {
        if (!token || token !== request.previewToken || request.previewById !== admin.id || !request.filename) {
          throw new IssuanceError("Prepare and review a new PDF preview before approving.")
        }
        const document = await renderIssuance(tx, request)
        if (document.fingerprint !== request.previewFingerprint) {
          throw new IssuanceError("The document content changed. Prepare and review a new preview.")
        }
      }
      const approved = decision === "approve"
      await tx.gradeDocumentRequest.update({
        where: { id, status: "PENDING" },
        data: {
          status: approved ? "APPROVED" : "REJECTED", pendingKey: null,
          reviewedById: admin.id, reviewedAt: new Date(), rejectionReason: approved ? null : reason,
          previewById: null, previewToken: null, previewFingerprint: null,
          ...(approved ? {} : { pdf: null, filename: null }),
        },
      })
      await tx.auditLog.create({
        data: {
          ...scope, actorUserId: admin.id, entityType: "GradeDocumentRequest", entityId: id,
          action: approved ? "grade_document.approve" : "grade_document.reject",
        },
      })
      await tx.notification.create({
        data: {
          organizationId: scope.organizationId, userId: request.studentId,
          type: "SYSTEM_NOTICE", title: approved ? "Grade document approved" : "Grade document request rejected",
          body: approved ? `${documentTitle(request)} is ready to download.` : `${documentTitle(request)} · ${reason}`,
          actionUrl: "/student#grade-documents",
        },
      })
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 })
    revalidatePath("/admin/grades-documents")
    revalidatePath("/student")
    revalidatePath("/parent", "layout")
    return { ok: true, message: decision === "preview" ? "PDF preview is ready." : "Decision saved." }
  } catch (error) {
    return actionFailure(error, "Could not process the request. Try again.")
  }
}
