import Link from "next/link"
import { UserRole } from "@prisma/client"
import { getPrismaClient } from "@/lib/prisma"
import { requireAnyRole } from "@/modules/auth/permissions"
import { formatDateTimeInTimeZone } from "@/lib/timezone"
import { CatalogForm } from "@/modules/catalog/action-form"
import { cancelEnrollmentRequest, requestEnrollment } from "@/modules/catalog/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default async function CatalogPage({ searchParams }: { searchParams: Promise<{ q?: string; organizationId?: string; status?: string; page?: string }> }) {
  const user = await requireAnyRole([UserRole.STUDENT]), params = await searchParams, prisma = getPrismaClient(), now = new Date()
  const page = Math.max(1, Math.min(10000, Number.parseInt(params.page ?? "1") || 1))
  const statuses = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const
  const status = statuses.find(s => s === params.status)
  const organizations = await prisma.organization.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } })
  const where = {
    organization: { isActive: true },
    ...(params.organizationId ? { organizationId: params.organizationId } : {}),
    ...(params.q ? { name: { contains: params.q.slice(0, 200), mode: "insensitive" as const } } : {}),
    ...(status ? { enrollmentRequests: { some: { studentId: user.id, status } } } : { isRecruiting: true, OR: [{ endsAt: null }, { endsAt: { gt: now } }] }),
  }
  const [sections, count] = await Promise.all([prisma.classSection.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: 24, skip: (page - 1) * 24, include: { organization: { select: { name: true, timezone: true } }, instructors: { select: { instructor: { select: { name: true } } } }, _count: { select: { enrollments: { where: { status: "ENROLLED" } } } }, enrollments: { where: { studentId: user.id }, select: { status: true } }, enrollmentRequests: { where: { studentId: user.id }, select: { id: true, status: true, rejectionReason: true } } } }), prisma.classSection.count({ where })])
  function pageUrl(value: number) { const query = new URLSearchParams({ ...(params.q ? { q: params.q } : {}), ...(params.organizationId ? { organizationId: params.organizationId } : {}), ...(status ? { status } : {}), page: String(value) }); return `/student/catalog?${query}` }
  return <div className="mx-auto w-full max-w-6xl space-y-6"><header><h1 className="text-2xl font-semibold">Browse classes</h1><p className="mt-2 text-slate-600">Find a class across our schools. Lessons become available after school approval.</p></header>
    <form className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2 lg:grid-cols-4"><Input name="q" aria-label="Search classes" placeholder="Search class name" defaultValue={params.q} /><select name="organizationId" aria-label="Organization" defaultValue={params.organizationId ?? ""} className="h-10 min-w-0 rounded-lg border px-3"><option value="">All organizations</option>{organizations.map(o => <option value={o.id} key={o.id}>{o.name}</option>)}</select><select name="status" aria-label="Application status" defaultValue={status ?? ""} className="h-10 rounded-lg border px-3"><option value="">Open for applications</option>{statuses.map(s => <option key={s}>{s}</option>)}</select><Button type="submit">Search</Button></form>
    <p className="text-sm text-slate-600">{count} classes · Page {page}</p><div className="grid gap-4 md:grid-cols-2">{sections.map(s => {
      const request = s.enrollmentRequests[0], enrollment = s.enrollments[0], blocked = enrollment && ["ENROLLED", "COMPLETED"].includes(enrollment.status), open = s.isRecruiting && (!s.endsAt || s.endsAt > now)
      return <article key={s.id} className="min-w-0 space-y-4 rounded-xl border bg-white p-5"><div><p className="text-sm font-medium text-blue-700">{s.organization.name}</p><h2 className="mt-1 break-words text-xl font-semibold">{s.name}</h2><p className="mt-2 text-sm text-slate-600">{s.instructors.map(i => i.instructor.name).join(", ") || "Instructor to be confirmed"}</p></div><p className="whitespace-pre-wrap break-words text-sm">{s.catalogDescription || "Contact the school for class details."}</p><p className="text-sm text-slate-600">{formatDateTimeInTimeZone(s.startsAt, s.organization.timezone)} → {formatDateTimeInTimeZone(s.endsAt, s.organization.timezone)} · {s.organization.timezone}<br />Seats: {s._count.enrollments} / {s.capacity ?? "No limit"}</p>
        {request ? <p className="text-sm font-medium">Application: {request.status}{request.rejectionReason ? ` · ${request.rejectionReason}` : ""}</p> : null}
        {enrollment?.status === "ENROLLED" ? <Button asChild variant="outline"><Link href={`/student/classes/${s.id}`}>Open my class</Link></Button> : blocked ? <p className="text-sm">Completed</p> : request?.status === "PENDING" ? <CatalogForm action={cancelEnrollmentRequest}><input type="hidden" name="requestId" value={request.id} /><Button variant="outline">Cancel application</Button></CatalogForm> : open ? <CatalogForm action={requestEnrollment}><input type="hidden" name="classSectionId" value={s.id} /><Button>{request ? "Apply again" : "Apply for class"}</Button></CatalogForm> : <p className="text-sm text-slate-600">Applications closed</p>}
      </article>
    })}</div>{!sections.length ? <p className="rounded-xl border bg-white p-6 text-slate-600">No classes found. Try a different filter.</p> : null}<nav aria-label="Catalog pages" className="flex gap-3">{page > 1 ? <Button asChild variant="outline"><Link href={pageUrl(page - 1)}>Previous</Link></Button> : null}{page * 24 < count ? <Button asChild variant="outline"><Link href={pageUrl(page + 1)}>Next</Link></Button> : null}</nav>
  </div>
}
