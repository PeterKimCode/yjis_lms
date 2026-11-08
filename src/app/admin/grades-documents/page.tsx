import Link from "next/link"
import { notFound } from "next/navigation"
import type { Prisma } from "@prisma/client"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { getPrismaClient } from "@/lib/prisma"
import { formatDateTimeInTimeZone } from "@/lib/timezone"
import { requireAnyRole } from "@/modules/auth/permissions"
import { CatalogForm } from "@/modules/catalog/action-form"
import { reviewScope } from "@/modules/catalog/rules"
import { SimpleTable, TableCell, TableRow } from "@/modules/dashboards/components"
import { countedEnrollments, documentTitle, getIssuanceReadiness, issuanceScope, issuerRoles, requestSummary } from "@/modules/documents/issuance"
import { prepareGradeDocument, reviewGradeDocument } from "@/modules/documents/issuance-actions"
import { publishedStatuses } from "@/modules/documents/pdf"

export const metadata = { title: "Grades & Documents" }

type Filters = {
  tab?: string
  status?: string
  requestId?: string
  year?: string
  term?: string
  campus?: string
  q?: string
  studentId?: string
  page?: string
}

type Admin = Awaited<ReturnType<typeof requireAnyRole>>
const base = "/admin/grades-documents"
const pageSize = 25
const selectClass = "min-w-0 rounded-md border bg-white px-3 py-2"
const statuses = ["PENDING", "APPROVED", "REJECTED"] as const

export default async function GradesDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [admin, query] = await Promise.all([requireAnyRole([...issuerRoles]), searchParams])
  const filters: Filters = Object.fromEntries(
    Object.entries(query).filter(([, value]) => typeof value === "string")
  )
  const requestsTab = filters.tab === "requests"
  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <h1 className="text-2xl font-semibold">Grades &amp; Documents</h1>
      <nav aria-label="Grades and documents" className="flex flex-wrap gap-2">
        <Button asChild variant={requestsTab ? "outline" : "default"}>
          <Link href={base} aria-current={requestsTab ? undefined : "page"}>Term grades</Link>
        </Button>
        <Button asChild variant={requestsTab ? "default" : "outline"}>
          <Link href={`${base}?tab=requests`} aria-current={requestsTab ? "page" : undefined}>Document requests</Link>
        </Button>
      </nav>
      {requestsTab ? <DocumentRequests admin={admin} filters={filters} /> : <TermGrades admin={admin} filters={filters} />}
    </div>
  )
}

async function TermGrades({ admin, filters }: { admin: Admin; filters: Filters }) {
  const prisma = getPrismaClient()
  const scope = reviewScope(admin.roleAssignments)
  const [years, terms, campuses] = await Promise.all([
    prisma.academicYear.findMany({
      where: { classSections: { some: scope } },
      select: { id: true, name: true, organization: { select: { name: true } } },
      orderBy: [{ startsAt: "desc" }, { id: "asc" }],
    }),
    prisma.term.findMany({
      where: { classSections: { some: scope }, ...(filters.year ? { academicYearId: filters.year } : {}) },
      select: { id: true, name: true, academicYear: { select: { name: true } }, organization: { select: { name: true } } },
      orderBy: [{ startsAt: "desc" }, { id: "asc" }],
    }),
    prisma.campus.findMany({
      where: { classSections: { some: scope } },
      select: { id: true, name: true, organization: { select: { name: true } } },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    }),
  ])
  const term = terms.find((option) => option.id === filters.term) ?? terms[0]
  const q = filters.q?.trim().slice(0, 120) ?? ""
  const enrolled: Prisma.EnrollmentWhereInput = {
    status: { in: [...countedEnrollments] },
    classSection: { ...scope, termId: term?.id ?? "", ...(filters.campus ? { campusId: filters.campus } : {}) },
  }
  const where: Prisma.UserWhereInput = {
    enrollments: { some: enrolled },
    ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
    ...(filters.studentId ? { id: filters.studentId } : {}),
  }
  const total = await prisma.user.count({ where })
  const page = getPage(filters.page, total)
  const students = await prisma.user.findMany({
    where, orderBy: [{ name: "asc" }, { id: "asc" }], skip: (page - 1) * pageSize, take: pageSize,
    select: {
      id: true, name: true, organization: { select: { name: true } },
      enrollments: {
        where: enrolled,
        orderBy: [{ classSection: { name: "asc" } }, { id: "asc" }],
        select: {
          classSection: {
            select: {
              id: true, name: true, campus: { select: { name: true } }, course: { select: { title: true } },
              instructors: { select: { instructor: { select: { name: true } } } },
            },
          },
        },
      },
    },
  })
  const grades = await prisma.finalGrade.findMany({
    where: {
      studentId: { in: students.map((student) => student.id) },
      classSection: enrolled.classSection,
    },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    distinct: ["studentId", "classSectionId"],
    select: { classSectionId: true, studentId: true, status: true, percentage: true, numericScore: true, letterGrade: true },
  })
  const gradeByStudentAndSection = new Map(grades.map((grade) => [`${grade.studentId}:${grade.classSectionId}`, grade]))
  const href = (next: { studentId?: string; page?: number }) => {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries({ year: filters.year, term: term?.id, campus: filters.campus, q, ...next })) {
      if (value) params.set(key, String(value))
    }
    return `${base}?${params}`
  }
  return (
    <>
      <form className="grid items-end gap-3 rounded-lg border p-4 sm:grid-cols-2 xl:grid-cols-5">
        <label className="grid gap-1 text-sm">Academic year
          <select className={selectClass} name="year" defaultValue={filters.year ?? ""}>
            <option value="">All academic years</option>
            {years.map((year) => <option key={year.id} value={year.id}>{year.name} · {year.organization.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm">Term
          <select className={selectClass} name="term" defaultValue={term?.id ?? ""}>
            {terms.length ? terms.map((option) => <option key={option.id} value={option.id}>{option.academicYear.name} · {option.name} · {option.organization.name}</option>) : <option value="">No terms</option>}
          </select>
        </label>
        <label className="grid gap-1 text-sm">Campus
          <select className={selectClass} name="campus" defaultValue={filters.campus ?? ""}>
            <option value="">All campuses</option>
            {campuses.map((campus) => <option key={campus.id} value={campus.id}>{campus.name} · {campus.organization.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm">Student name
          <input className={selectClass} name="q" defaultValue={q} maxLength={120} />
        </label>
        <Button type="submit">Apply filters</Button>
      </form>
      {filters.studentId ? <Button asChild variant="outline"><Link href={href({})}>Back to term grades</Link></Button> : null}
      <p className="text-sm text-muted-foreground">{total} {total === 1 ? "student" : "students"}</p>
      {students.map((student) => {
        const rows = student.enrollments.map(({ classSection }) => ({
          section: classSection,
          grade: gradeByStudentAndSection.get(`${student.id}:${classSection.id}`),
        }))
        const submitted = rows.filter(({ grade }) => grade && publishedStatuses.includes(grade.status)).length
        return (
          <article key={student.id} className="space-y-3 rounded-lg border p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="break-words font-semibold">{student.name}</h2>
                <p className="text-sm text-muted-foreground">{student.organization.name} · Grades submitted {submitted} / {rows.length}</p>
              </div>
              {!filters.studentId ? <Button asChild variant="outline" size="sm"><Link href={href({ studentId: student.id })}>View grades</Link></Button> : null}
            </div>
            {filters.studentId ? (
              <SimpleTable empty="No enrolled classes." headers={["Course / Class", "Campus", "Instructor", "Score", "Grade", "Status"]} rows={rows.map(({ section, grade }) => (
                <TableRow key={section.id}>
                  <TableCell>{section.course.title} / {section.name}</TableCell>
                  <TableCell>{section.campus?.name ?? "—"}</TableCell>
                  <TableCell>{section.instructors.map(({ instructor }) => instructor.name).join(", ") || "—"}</TableCell>
                  <TableCell>{(grade?.percentage ?? grade?.numericScore)?.toString() ?? "—"}</TableCell>
                  <TableCell>{grade?.letterGrade ?? "—"}</TableCell>
                  <TableCell>{grade?.status ?? "Not entered"}</TableCell>
                </TableRow>
              ))} />
            ) : null}
          </article>
        )
      })}
      {!total ? <p className="rounded-lg border p-4">No students match these filters.</p> : null}
      <Pager page={page} total={total} href={(next) => href({ page: next })} />
    </>
  )
}

async function DocumentRequests({ admin, filters }: { admin: Admin; filters: Filters }) {
  const prisma = getPrismaClient()
  const status = statuses.find((option) => option === filters.status) ?? "PENDING"
  const list = `${base}?tab=requests&status=${status}`
  const scope = issuanceScope(admin.roleAssignments)
  if (filters.requestId) {
    const request = await prisma.gradeDocumentRequest.findFirst({
      where: { id: filters.requestId, student: scope },
      select: {
        ...requestSummary, previewToken: true, previewById: true,
        student: { select: { name: true, organization: { select: { name: true, timezone: true } } } },
      },
    })
    if (!request) notFound()
    const pending = request.status === "PENDING"
    const readiness = pending ? await getIssuanceReadiness(prisma, request) : null
    const previewToken = pending && request.previewById === admin.id ? request.previewToken : null
    const endpoint = `/api/documents/${request.documentType === "TRANSCRIPT" ? "transcript" : "report-card"}?requestId=${request.id}`
    const previewUrl = previewToken ? `${endpoint}&preview=${previewToken}` : null
    return (
      <>
        <Button asChild variant="outline"><Link href={list}>Back to document requests</Link></Button>
        <article className="space-y-4 rounded-lg border p-4">
          <h2 className="text-lg font-semibold">{documentTitle(request)}</h2>
          <p>{request.student.name} · {request.student.organization.name} · {request.status}</p>
          <p className="text-sm text-muted-foreground">Requested {formatDateTimeInTimeZone(request.createdAt, request.student.organization.timezone)}</p>
          {request.rejectionReason ? <p className="break-words">Reason: {request.rejectionReason}</p> : null}
          {request.status === "APPROVED" ? <Button asChild variant="outline"><a href={endpoint}>Download issued PDF</a></Button> : null}
          {readiness ? (
            <>
              {readiness.missing.length ? (
                <div className="rounded-lg border p-3 text-sm">
                  <p className="font-semibold">Courses without published grades</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {readiness.missing.map((section) => <li key={section.id}>{section.course.title} / {section.name}{section.term ? ` · ${section.term.name}` : ""}</li>)}
                  </ul>
                </div>
              ) : null}
              {readiness.eligible ? (
                <CatalogForm action={prepareGradeDocument}>
                  <input type="hidden" name="requestId" value={request.id} />
                  <Button type="submit" variant="outline">{previewToken ? "Refresh PDF preview" : "Prepare PDF preview"}</Button>
                </CatalogForm>
              ) : <p role="status" className="text-sm text-muted-foreground">Required published grades are not ready for issuance.</p>}
              {previewUrl && readiness.eligible ? (
                <>
                  <a className="text-sm font-medium text-primary underline" href={previewUrl} target="_blank" rel="noreferrer">Open PDF preview in a new tab</a>
                  <iframe title="PDF preview for approval" key={previewUrl} src={previewUrl} className="h-[65vh] w-full rounded-md border" />
                </>
              ) : null}
              <CatalogForm action={reviewGradeDocument}>
                <input type="hidden" name="requestId" value={request.id} />
                <input type="hidden" name="previewToken" value={previewToken ?? ""} />
                <label className="grid gap-1 text-sm">Reason for rejection
                  <Textarea name="reason" maxLength={1000} />
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" name="decision" value="approve" disabled={!previewToken || !readiness.eligible}>Approve issuance</Button>
                  <Button type="submit" name="decision" value="reject" variant="destructive">Reject request</Button>
                </div>
              </CatalogForm>
            </>
          ) : null}
        </article>
      </>
    )
  }
  const where = { status, student: scope }
  const total = await prisma.gradeDocumentRequest.count({ where })
  const page = getPage(filters.page, total)
  const requests = await prisma.gradeDocumentRequest.findMany({
    where, skip: (page - 1) * pageSize, take: pageSize,
    orderBy: [{ createdAt: status === "PENDING" ? "asc" : "desc" }, { id: "asc" }],
    select: {
      ...requestSummary,
      student: { select: { name: true, organization: { select: { name: true, timezone: true } } } },
    },
  })
  return (
    <>
      <nav aria-label="Request status" className="flex flex-wrap gap-2">
        {statuses.map((option) => (
          <Button key={option} asChild size="sm" variant={status === option ? "default" : "outline"}>
            <Link href={`${base}?tab=requests&status=${option}`} aria-current={status === option ? "page" : undefined}>{option[0] + option.slice(1).toLowerCase()}</Link>
          </Button>
        ))}
      </nav>
      <SimpleTable empty="No requests with this status." headers={["Student", "School", "Document", "Requested", "Open"]} rows={requests.map((request) => (
        <TableRow key={request.id}>
          <TableCell>{request.student.name}</TableCell>
          <TableCell>{request.student.organization.name}</TableCell>
          <TableCell>{documentTitle(request)}</TableCell>
          <TableCell>{formatDateTimeInTimeZone(request.createdAt, request.student.organization.timezone)}</TableCell>
          <TableCell><Button asChild size="sm" variant="outline"><Link href={`${list}&requestId=${request.id}`}>{status === "PENDING" ? "Review" : "Open"}</Link></Button></TableCell>
        </TableRow>
      ))} />
      <Pager page={page} total={total} href={(next) => `${list}&page=${next}`} />
    </>
  )
}

function getPage(value: string | undefined, total: number) {
  const page = Number(value)
  return Number.isSafeInteger(page) && page > 0 ? Math.min(page, Math.max(1, Math.ceil(total / pageSize))) : 1
}

function Pager({ page, total, href }: { page: number; total: number; href: (page: number) => string }) {
  if (total <= pageSize) return null
  const pages = Math.ceil(total / pageSize)
  return (
    <nav aria-label="Pagination" className="flex items-center gap-3">
      {page > 1 ? <Button asChild size="sm" variant="outline"><Link href={href(page - 1)}>Previous</Link></Button> : null}
      <span className="text-sm">Page {page} / {pages}</span>
      {page < pages ? <Button asChild size="sm" variant="outline"><Link href={href(page + 1)}>Next</Link></Button> : null}
    </nav>
  )
}
