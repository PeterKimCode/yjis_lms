import "server-only"

import type { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"
import { getPrismaClient } from "@/lib/prisma"
import { startOfTodayInTimeZone } from "@/lib/timezone"
import { getCurrentUser } from "@/modules/auth/permissions"
import { writeAuditLog } from "@/modules/audit/service"
import { issuanceScope, issuerRoles } from "./issuance"
import { generateReportCardPdf, generateTranscriptPdf } from "./pdf"

const forbidden = () => NextResponse.json({ error: "This document is not available to you." }, { status: 403 })

function pdfResponse(pdf: Uint8Array, filename: string, inline = false) {
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`,
      "Content-Type": "application/pdf",
      "X-Content-Type-Options": "nosniff",
    },
  })
}

export async function downloadGradeDocument(request: Request, documentType: "REPORT_CARD" | "TRANSCRIPT") {
  if (request.method !== "GET") return new Response(null, { status: 405, headers: { Allow: "GET" } })
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const requestId = searchParams.get("requestId")
    const previewToken = searchParams.get("preview")
    const studentId = searchParams.get("studentId") ?? user.id
    const termId = searchParams.get("termId")
    const prisma = getPrismaClient()
    const isIssuer = user.roleAssignments.some((assignment) => issuerRoles.some((role) => role === assignment.role))
    const adminScope = issuanceScope(user.roleAssignments)

    if (previewToken) {
      if (!isIssuer || !requestId) return forbidden()
      const preview = await prisma.gradeDocumentRequest.findFirst({
        where: {
          id: requestId, documentType, status: "PENDING", student: adminScope,
          previewToken, previewById: user.id,
        },
        select: { pdf: true, filename: true },
      })
      return preview?.pdf && preview.filename ? pdfResponse(preview.pdf, preview.filename, true) : forbidden()
    }

    // Existing staff links are previews and never authorize student downloads.
    if (isIssuer && !requestId && await prisma.user.count({ where: { id: studentId, ...adminScope } })) {
      const input = { studentId }
      const document = documentType === "REPORT_CARD"
        ? await generateReportCardPdf({ ...input, termId })
        : await generateTranscriptPdf(input)
      if (!document) return forbidden()
      await writeAuditLog({
        action: "grade_document.admin_preview", actorUserId: user.id, entityId: studentId,
        entityType: "GradeDocumentRequest", organizationId: document.organizationId,
      })
      return pdfResponse(new Uint8Array(document.pdf), document.filename)
    }

    if (!requestId && documentType === "REPORT_CARD" && !termId) return forbidden()

    const download = await prisma.$transaction(async (tx) => {
      const where: Prisma.GradeDocumentRequestWhereInput = {
        documentType, status: "APPROVED",
        ...(requestId ? { id: requestId } : { studentId, ...(documentType === "REPORT_CARD" ? { termId } : {}) }),
      }
      const candidate = await tx.gradeDocumentRequest.findFirst({
        where, orderBy: [{ reviewedAt: "desc" }, { id: "desc" }],
        select: { id: true, studentId: true },
      })
      if (!candidate) return null

      const student = await tx.user.findUnique({
        where: { id: candidate.studentId },
        select: {
          organizationId: true, organization: { select: { timezone: true } },
          studentProfile: { select: { campusId: true } },
        },
      })
      if (!student) return null
      const staff = isIssuer && Boolean(await tx.user.count({ where: { id: candidate.studentId, ...adminScope } }))
      const own = candidate.studentId === user.id && user.roleAssignments.some((assignment) => assignment.role === "STUDENT")
      const linked = user.roleAssignments.some((assignment) => assignment.role === "PARENT")
        && Boolean(await tx.parentStudentRelation.count({ where: { parentId: user.id, studentId: candidate.studentId } }))
      if (!staff && !own && !linked) return null

      const document = await tx.gradeDocumentRequest.findUnique({
        where: { id: candidate.id, status: "APPROVED" },
        select: { pdf: true, filename: true },
      })
      if (!document?.pdf || !document.filename) return null
      if (documentType === "TRANSCRIPT" && !staff) {
        // Serialize quota checks for all downloads of this student's transcripts.
        await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${candidate.studentId} FOR UPDATE`
        const count = await tx.auditLog.count({
          where: {
            entityId: candidate.studentId,
            action: "grade_document.transcript_download",
            createdAt: { gte: startOfTodayInTimeZone(student.organization.timezone) },
          },
        })
        if (count >= 3) return "limit"
        await tx.auditLog.create({
          data: {
            action: "grade_document.transcript_download", entityType: "User", entityId: candidate.studentId,
            actorUserId: user.id, organizationId: student.organizationId,
            campusId: student.studentProfile?.campusId, metadata: { requestId: candidate.id },
          },
        })
      } else await tx.auditLog.create({
        data: {
          action: "grade_document.download", actorUserId: user.id, entityId: candidate.id,
          entityType: "GradeDocumentRequest", organizationId: student.organizationId,
          campusId: student.studentProfile?.campusId,
        },
      })
      return { pdf: document.pdf, filename: document.filename }
    })

    if (download === "limit") {
      return NextResponse.json({ error: "Transcript downloads are limited to 3 times per day." }, { status: 429 })
    }
    return download ? pdfResponse(download.pdf, download.filename) : forbidden()
  } catch (error) {
    console.error("Grade document download failed", error instanceof Error ? error.name : "Unknown error")
    return NextResponse.json({ error: "Could not download the document. Please try again." }, { status: 500 })
  }
}
