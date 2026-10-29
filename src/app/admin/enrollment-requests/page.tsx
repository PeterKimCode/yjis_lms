import { UserRole } from "@prisma/client"
import { requireAnyRole } from "@/modules/auth/permissions"
import { getPrismaClient } from "@/lib/prisma"
import { reviewScope } from "@/modules/catalog/rules"
import { reviewEnrollmentRequest } from "@/modules/catalog/actions"
import { CatalogForm } from "@/modules/catalog/action-form"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { formatDateTimeInTimeZone } from "@/lib/timezone"
export default async function EnrollmentRequestsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const user = await requireAnyRole([UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN]), params = await searchParams
  const status = (["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const).find(s => s === params.status) ?? "PENDING"
  const requests = await getPrismaClient().enrollmentRequest.findMany({ where: { status, classSection: reviewScope(user.roleAssignments) }, orderBy: { createdAt: "asc" }, include: { student: { select: { name: true, organization: { select: { name: true } } } }, classSection: { select: { name: true, organization: { select: { name: true, timezone: true } } } } } })
  return <div className="mx-auto w-full max-w-5xl space-y-6"><header><h1 className="text-2xl font-semibold">Enrollment requests</h1><p className="mt-2 text-slate-600">Approve students for your classes. This does not change their home school or role.</p></header><form className="flex flex-wrap gap-3"><select aria-label="Request status" name="status" defaultValue={status} className="h-10 rounded-lg border bg-white px-3">{["PENDING", "APPROVED", "REJECTED", "CANCELLED"].map(s => <option key={s}>{s}</option>)}</select><Button variant="outline">Filter</Button></form><p>{requests.length} {status.toLowerCase()} requests</p><div className="grid gap-4 md:grid-cols-2">{requests.map(r => <article key={r.id} className="min-w-0 space-y-4 rounded-xl border bg-white p-5"><h2 className="break-words text-lg font-semibold">{r.classSection.name}</h2><p className="text-sm">{r.classSection.organization.name}<br />Student: {r.student.name}<br />Home school: {r.student.organization.name}<br />Requested: {formatDateTimeInTimeZone(r.createdAt, r.classSection.organization.timezone)}</p>{r.status === "PENDING" ? <CatalogForm action={reviewEnrollmentRequest}><input type="hidden" name="requestId" value={r.id} /><label className="grid gap-2 text-sm">Reason (required to reject)<Textarea name="reason" maxLength={1000} /></label><div className="flex flex-wrap gap-2"><Button name="decision" value="APPROVED">Approve</Button><Button variant="destructive" name="decision" value="REJECTED">Reject</Button></div></CatalogForm> : <p className="text-sm">{r.status}{r.rejectionReason ? ` · ${r.rejectionReason}` : ""}</p>}</article>)}</div>{!requests.length ? <p className="rounded-xl border bg-white p-6">No requests in this category.</p> : null}</div>
}
