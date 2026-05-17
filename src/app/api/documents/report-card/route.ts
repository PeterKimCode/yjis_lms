import { NextResponse } from "next/server"

import { getCurrentSession } from "@/modules/auth/session"
import {
  assertStudentDocumentAccess,
  generateReportCardPdf,
} from "@/modules/documents/pdf"

export async function GET(request: Request) {
  const session = await getCurrentSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 })
  }

  const url = new URL(request.url)
  const studentId = url.searchParams.get("studentId") ?? session.user.id
  const termId = url.searchParams.get("termId")
  const access = await assertStudentDocumentAccess({
    currentUserId: session.user.id,
    roleAssignments: session.user.roleAssignments,
    studentId,
  })

  if (!access) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const document = await generateReportCardPdf({
    access,
    studentId,
    termId,
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
}
