import { NextResponse } from "next/server"
import { DocumentStatus, DocumentType } from "@prisma/client"

import { getPrismaClient } from "@/lib/prisma"
import { getCurrentSession } from "@/modules/auth/session"
import { writeAuditLog } from "@/modules/audit/service"
import { startOfTodayInTimeZone } from "@/lib/timezone"
import {
  assertStudentDocumentAccess,
  generateTranscriptPdf,
} from "@/modules/documents/pdf"

export async function GET(request: Request) {
  try {
    const session = await getCurrentSession()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const url = new URL(request.url)
    const studentId = url.searchParams.get("studentId") ?? session.user.id
    const access = await assertStudentDocumentAccess({
      currentUserId: session.user.id,
      roleAssignments: session.user.roleAssignments,
      studentId,
    })

    if (!access) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const student = await getPrismaClient().user.findUnique({
      where: { id: studentId },
      select: { organization: { select: { timezone: true } }, organizationId: true },
    })

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    if (!access.canPreviewDrafts) {
      const hasApprovedTranscript = await getApprovedTranscriptCount(studentId)

      if (!hasApprovedTranscript) {
        return NextResponse.json(
          {
            error:
              "Transcript download is not available yet. An admin must approve it first.",
          },
          { status: 403 }
        )
      }

      const downloadsToday = await getTodayTranscriptDownloadCount(
        studentId,
        student.organization.timezone
      )

      if (downloadsToday >= 3) {
        return NextResponse.json(
          { error: "Transcript downloads are limited to 3 times per day." },
          { status: 429 }
        )
      }
    }

    const document = await generateTranscriptPdf({
      access,
      studentId,
    })

    if (!document) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    await writeAuditLog({
      action: "document.transcript.download",
      actorUserId: session.user.id,
      entityId: studentId,
      entityType: "Transcript",
      organizationId: document.organizationId,
      summary: `Transcript downloaded for student ${studentId}.`,
    })

    return new Response(document.pdf, {
      headers: {
        "Content-Disposition": `attachment; filename="${document.filename}"`,
        "Content-Type": "application/pdf",
      },
    })
  } catch (error) {
    console.error("Transcript PDF generation failed", {
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json(
      { error: "PDF generation failed. Please try again." },
      { status: 500 }
    )
  }
}

async function getTodayTranscriptDownloadCount(
  studentId: string,
  timeZone: string | null | undefined
) {
  return getPrismaClient().generatedDocument.count({
    where: {
      createdAt: { gte: startOfTodayInTimeZone(timeZone) },
      documentType: DocumentType.TRANSCRIPT,
      studentId,
    },
  })
}

async function getApprovedTranscriptCount(studentId: string) {
  return getPrismaClient().generatedDocument.count({
    where: {
      documentType: DocumentType.TRANSCRIPT,
      status: DocumentStatus.GENERATED,
      studentId,
    },
  })
}
