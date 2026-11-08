import "server-only"

import type { Prisma } from "@prisma/client"
import { getPrismaClient } from "@/lib/prisma"
import { reviewScope } from "@/modules/catalog/rules"
import { generateReportCardPdf, generateTranscriptPdf, publishedStatuses } from "./pdf"

export const issuerRoles = ["SCHOOL_ADMIN", "SUPER_ADMIN"] as const
export const countedEnrollments = ["ENROLLED", "COMPLETED"] as const

export function issuanceScope(assignments: Parameters<typeof reviewScope>[0]): Prisma.UserWhereInput {
  return { studentProfile: { is: reviewScope(assignments) } }
}

export const requestSummary = {
  id: true, studentId: true, documentType: true, status: true, termId: true,
  termLabel: true, createdAt: true, reviewedAt: true, rejectionReason: true,
} satisfies Prisma.GradeDocumentRequestSelect

export type RequestSummary = Prisma.GradeDocumentRequestGetPayload<{ select: typeof requestSummary }>

export async function getStudentDocumentTerms(studentId: string, db: Prisma.TransactionClient = getPrismaClient()) {
  return db.term.findMany({
    where: { classSections: { some: { enrollments: { some: { studentId, status: { in: [...countedEnrollments] } } } } } },
    select: { id: true, name: true, academicYear: { select: { name: true } }, organization: { select: { name: true } } },
    orderBy: [{ startsAt: "desc" }, { id: "asc" }],
  })
}

export async function getIssuanceReadiness(
  db: Prisma.TransactionClient,
  request: Pick<RequestSummary, "studentId" | "documentType" | "termId">
) {
  const { studentId, termId, documentType } = request
  const reportCard = documentType === "REPORT_CARD"
  if (reportCard && !termId) return { eligible: false, missing: [] }
  const published = { studentId, status: { in: publishedStatuses } }
  const [missing, count] = await Promise.all([
    db.classSection.findMany({
      where: {
        ...(reportCard ? { termId } : {}),
        enrollments: { some: { studentId, status: { in: [...countedEnrollments] } } },
        finalGrades: { none: published },
      },
      select: { id: true, name: true, course: { select: { title: true } }, term: { select: { name: true } } },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    }),
    db.finalGrade.count({
      where: {
        ...published,
        ...(reportCard ? { classSection: { termId, enrollments: { some: { studentId, status: { in: [...countedEnrollments] } } } } } : {}),
      },
    }),
  ])
  return { eligible: count > 0 && (!reportCard || missing.length === 0), missing }
}

export async function renderIssuance(db: Prisma.TransactionClient, request: RequestSummary) {
  const { eligible } = await getIssuanceReadiness(db, request)
  if (!eligible) throw new IssuanceError("The required published grades are not ready for issuance.")
  const input = {
    studentId: request.studentId,
    issuanceDb: db,
  }
  const document = request.documentType === "REPORT_CARD"
    ? await generateReportCardPdf({ ...input, termId: request.termId })
    : await generateTranscriptPdf(input)
  if (!document) throw new IssuanceError("The student could not be found.")
  return document
}

export class IssuanceError extends Error {}

export function documentTitle(document: Pick<RequestSummary, "documentType" | "termLabel">) {
  return document.documentType === "TRANSCRIPT" ? "Transcript" : `Report card · ${document.termLabel ?? "Term unavailable"}`
}
