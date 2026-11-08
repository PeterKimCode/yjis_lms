import { Button } from "@/components/ui/button"
import { getPrismaClient } from "@/lib/prisma"
import { formatDateTimeInTimeZone } from "@/lib/timezone"
import { CatalogForm } from "@/modules/catalog/action-form"
import { documentTitle, getStudentDocumentTerms, requestSummary } from "./issuance"
import { requestGradeDocument } from "./issuance-actions"
import { TranscriptDownloadButton } from "./transcript-download-button"

export async function StudentDocuments({ studentId, canRequest }: { studentId: string; canRequest: boolean }) {
  const prisma = getPrismaClient()
  const [terms, requests, student] = await Promise.all([
    canRequest ? getStudentDocumentTerms(studentId) : [],
    prisma.gradeDocumentRequest.findMany({
      where: { studentId, ...(canRequest ? {} : { status: "APPROVED" }) },
      select: requestSummary,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    }),
    prisma.user.findUnique({ where: { id: studentId }, select: { organization: { select: { timezone: true } } } }),
  ])
  const pending = requests.filter((request) => request.status === "PENDING")
  const pendingTerms = new Set(pending.filter((request) => request.documentType === "REPORT_CARD").map((request) => request.termId))
  const transcriptPending = pending.some((request) => request.documentType === "TRANSCRIPT")
  const availableTerms = terms.filter((term) => !pendingTerms.has(term.id))
  return (
    <div id={canRequest ? "grade-documents" : undefined} className="space-y-4 scroll-mt-24">
      {canRequest ? (
        <div className="space-y-3">
          {availableTerms.length ? (
            <CatalogForm action={requestGradeDocument}>
              <input type="hidden" name="documentType" value="REPORT_CARD" />
              <label className="grid gap-1 text-sm font-medium">
                Report card term
                <select name="termId" className="w-full min-w-0 rounded-md border bg-white p-2">
                  {availableTerms.map((term) => <option key={term.id} value={term.id}>{term.academicYear.name} · {term.name} · {term.organization.name}</option>)}
                </select>
              </label>
              <Button type="submit" size="sm">Request report card</Button>
            </CatalogForm>
          ) : <p className="text-sm text-muted-foreground">{terms.length ? "Report card requests are pending." : "No enrolled terms for a report card."}</p>}
          {transcriptPending ? <p className="text-sm text-muted-foreground">Transcript request pending.</p> : (
            <CatalogForm action={requestGradeDocument}>
              <input type="hidden" name="documentType" value="TRANSCRIPT" />
              <Button type="submit" size="sm" variant="outline">Request transcript</Button>
            </CatalogForm>
          )}
        </div>
      ) : null}
      {requests.length ? (
        <ul className="grid gap-2">
          {requests.map((request) => (
            <li key={request.id} className="space-y-2 rounded-md border p-3 text-sm">
              <p className="break-words font-medium">{documentTitle(request)}</p>
              <p className="text-muted-foreground">
                {request.status === "APPROVED" ? "Approved" : request.status === "REJECTED" ? "Rejected" : "Pending"} · {formatDateTimeInTimeZone(request.reviewedAt ?? request.createdAt, student?.organization.timezone)}
              </p>
              {request.rejectionReason ? <p className="break-words">{request.rejectionReason}</p> : null}
              {request.status === "APPROVED" ? request.documentType === "TRANSCRIPT" ? (
                <TranscriptDownloadButton studentId={studentId} requestId={request.id} />
              ) : (
                <Button asChild size="sm" variant="outline">
                  <a href={`/api/documents/report-card?requestId=${request.id}`}>Download report card</a>
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-muted-foreground">{canRequest ? "No document requests yet." : "No approved grade documents yet."}</p>}
    </div>
  )
}
