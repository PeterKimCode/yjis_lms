import { NextResponse } from "next/server"
import { DocumentType } from "@prisma/client"

import { getPrismaClient } from "@/lib/prisma"
import { getCurrentSession } from "@/modules/auth/session"
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

    if (!access.canPreviewDrafts) {
      const downloadsToday = await getTodayTranscriptDownloadCount(studentId)

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

async function getTodayTranscriptDownloadCount(studentId: string) {
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  return getPrismaClient().generatedDocument.count({
    where: {
      createdAt: { gte: startOfDay },
      documentType: DocumentType.TRANSCRIPT,
      studentId,
    },
  })
}
