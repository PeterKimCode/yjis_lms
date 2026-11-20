import Link from "next/link"
import { DeliveryMode, type Prisma } from "@prisma/client"
import { Button } from "@/components/ui/button"
import { getPrismaClient } from "@/lib/prisma"
import { formatDateTimeInTimeZone } from "@/lib/timezone"
import { getClassSectionWhereForAdmin, requireAdmin } from "@/modules/admin/access"
import { AdminPageHeader, SearchForm } from "@/modules/admin/components"
import { AdminAttendanceTabs } from "@/modules/attendance/admin-tabs"
import { isQrOpen } from "@/modules/attendance/smart-rules"

export default async function AdminQrAttendancePage({ searchParams }: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const admin = await requireAdmin()
  const query = await searchParams
  const q = typeof query.q === "string" ? query.q.trim().slice(0, 120) : ""
  const requestedPage = Number(query.page)
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 1000) : 1
  const pageSize = 24
  const where: Prisma.ClassSessionWhereInput = {
    classSection: getClassSectionWhereForAdmin(admin),
    deliveryMode: { not: DeliveryMode.ONLINE },
    OR: [{ attendanceSession: null }, { attendanceSession: { qrOpenedAt: { not: null } } }],
    ...(q ? { AND: [{ OR: [
      { title: { contains: q, mode: "insensitive" } },
      { classSection: { name: { contains: q, mode: "insensitive" } } },
    ] }] } : {}),
  }
  const sessions = await getPrismaClient().classSession.findMany({
    where, orderBy: [{ startsAt: "desc" }, { id: "desc" }], skip: (page - 1) * pageSize, take: pageSize + 1,
    select: {
      id: true, title: true, startsAt: true, organization: { select: { name: true, timezone: true } },
      classSection: { select: { name: true } },
      attendanceSession: { select: { qrOpenedAt: true, qrClosesAt: true, qrFinalizedAt: true } },
    },
  })
  const now = new Date()
  const pageLink = (number: number) => `/admin/attendance/qr?${new URLSearchParams({ q, page: String(number) })}`

  return (
    <div className="space-y-4">
      <AdminPageHeader title="Attendance" description="" />
      <AdminAttendanceTabs view="qr" />
      <SearchForm q={q} placeholder="Search classes or sessions…" />
      {sessions.length ? (
        <ul className="grid gap-3 lg:grid-cols-2">
          {sessions.slice(0, pageSize).map((session) => {
            const attendance = session.attendanceSession
            const status = !attendance ? "Available" : attendance.qrFinalizedAt ? "Published" :
              isQrOpen(attendance, now) ? "Check-in open" : "Needs review"
            return (
              <li key={session.id} className="min-w-0 space-y-3 rounded-lg border bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="break-words font-semibold">{session.classSection.name}</h2>
                  <span className="rounded-full border bg-background px-2 py-1 text-xs font-medium">{status}</span>
                </div>
                <p className="break-words text-sm">{session.title ?? "Class session"} · {session.organization.name}</p>
                <p className="text-sm text-muted-foreground">{formatDateTimeInTimeZone(session.startsAt, session.organization.timezone)}</p>
                <Button asChild variant="outline"><Link href={`/attendance/${session.id}`}>Manage QR attendance</Link></Button>
              </li>
            )
          })}
        </ul>
      ) : <p className="rounded-lg border bg-white p-4">No in-person sessions match your search.</p>}
      <nav aria-label="QR session pages" className="flex flex-wrap gap-2">
        {page > 1 ? <Button asChild variant="outline"><Link href={pageLink(page - 1)}>Previous</Link></Button> : null}
        {sessions.length > pageSize ? <Button asChild variant="outline"><Link href={pageLink(page + 1)}>Next</Link></Button> : null}
      </nav>
    </div>
  )
}
