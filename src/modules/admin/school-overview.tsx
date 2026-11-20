import Link from "next/link"
import { notFound } from "next/navigation"
import type { Prisma } from "@prisma/client"
import { Button } from "@/components/ui/button"
import { getPrismaClient } from "@/lib/prisma"
import { AttendanceQrScanner } from "@/modules/attendance/qr-scanner"
import { recordSchoolAttendanceQr } from "@/modules/attendance/school-actions"
import { getSchoolAttendanceDay, getSchoolAttendanceScopes, getSchoolSchedules, schoolStudents } from "@/modules/attendance/school-data"
import { dailyLabels, minuteLabel, schoolScopeKey } from "@/modules/attendance/school-rules"
import { StudentQrRefresh } from "@/modules/attendance/student-qr"
import { reviewScope } from "@/modules/catalog/rules"
import { MetricCard } from "@/modules/dashboards/components"
import { issuanceScope } from "@/modules/documents/issuance"
import { getUnreadMessageCount } from "@/modules/messages/data"
import { getUnreadNotificationCount } from "@/modules/notifications/service"
import {
  getAcademicYearWhereForAdmin, getClassSectionWhereForAdmin, getCourseWhereForAdmin, getUserWhereForAdmin, type requireAdmin,
} from "./access"
import { AdminPageHeader } from "./components"

type Admin = Awaited<ReturnType<typeof requireAdmin>>

export async function SchoolAdminOverview({ admin, requestedScope }: { admin: Admin; requestedScope?: string }) {
  const prisma = getPrismaClient()
  const [scopes, yearCount, courses, classes, users, enrollments, documents, messages, notifications] = await Promise.all([
    getSchoolAttendanceScopes(admin.roleAssignments),
    prisma.academicYear.count({ where: getAcademicYearWhereForAdmin(admin) }),
    prisma.course.count({ where: getCourseWhereForAdmin(admin) }),
    prisma.classSection.count({ where: getClassSectionWhereForAdmin(admin) }),
    prisma.user.count({ where: getUserWhereForAdmin(admin) }),
    prisma.enrollmentRequest.count({ where: { status: "PENDING", classSection: reviewScope(admin.roleAssignments) } }),
    prisma.gradeDocumentRequest.count({ where: { status: "PENDING", student: issuanceScope(admin.roleAssignments) } }),
    getUnreadMessageCount(admin.id),
    getUnreadNotificationCount(admin.id),
  ])
  const selected = requestedScope
    ? scopes.find((scope) => schoolScopeKey(scope.organizationId, scope.campusId) === requestedScope)
    : scopes.find(({ organizationId }) => organizationId === admin.organizationId) ?? scopes[0]
  if (requestedScope && !selected) notFound()

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
      <AdminPageHeader title="School overview" description="" />
      {selected ? <SchoolAttendanceOverview selected={selected} scopes={scopes} /> : (
        <section className="space-y-2 rounded-lg border bg-white p-4">
          <h2 className="font-semibold">School attendance</h2>
          <p className="text-sm">No active schools or campuses are in your scope.</p>
        </section>
      )}
      <section className="space-y-3" aria-labelledby="school-overview-queue">
        <h2 id="school-overview-queue" className="text-lg font-semibold">Pending requests</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <MetricCard label="Enrollment requests" value={enrollments} href="/admin/enrollment-requests?status=PENDING" />
          <MetricCard label="Document requests" value={documents} href="/admin/grades-documents?tab=requests&status=PENDING" />
        </div>
      </section>
      <section className="space-y-3" aria-labelledby="school-overview-totals">
        <h2 id="school-overview-totals" className="text-lg font-semibold">Workspace totals</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard label="Courses" value={courses} href="/admin/courses" />
          <MetricCard label="Class Sections" value={classes} href="/admin/class-sections" />
          <MetricCard label="Users" value={users} href="/admin/users" />
          <MetricCard label="Academic Years" value={yearCount} />
          <MetricCard label="Messages" value={messages ? `${messages} unread` : "Open"} href="/messages" />
          <MetricCard label="Notifications" value={notifications ? `${notifications} unread` : "Open"} href="/notifications" />
        </div>
      </section>
    </div>
  )
}

type ScopeChoice = Awaited<ReturnType<typeof getSchoolAttendanceScopes>>[number]

async function SchoolAttendanceOverview({ selected, scopes }: { selected: ScopeChoice; scopes: ScopeChoice[] }) {
  const scope = { organizationId: selected.organizationId, campusId: selected.campusId }
  const scopeKey = schoolScopeKey(scope.organizationId, scope.campusId)
  const attendancePath = `/admin/attendance/today?${new URLSearchParams({ scope: scopeKey })}`
  const schedules = await getSchoolSchedules(scope.organizationId)
  const now = new Date()
  const { time, schoolDay, settled, schedule, phase, scannersOpen, canReview } =
    getSchoolAttendanceDay(scope, selected.timezone, schedules, now)
  const people: Prisma.UserWhereInput = { AND: [schoolStudents(scope, now), schoolDay] }
  const prisma = getPrismaClient()
  const [total, counts] = await Promise.all([
    prisma.user.count({ where: people }),
    prisma.schoolAttendanceRecord.groupBy({ by: ["status"], where: { ...settled, student: people }, _count: { _all: true } }),
  ])
  const countsByStatus = new Map(counts.map((row) => [row.status, row._count._all]))
  countsByStatus.set("PENDING", Math.max(0, total - counts.reduce((sum, row) => sum + row._count._all, 0)))

  return (
    <section aria-labelledby="school-overview-attendance" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 id="school-overview-attendance" className="text-lg font-semibold">School attendance</h2>
          <p className="break-words text-sm text-muted-foreground">{selected.label} · {time.date}</p>
        </div>
        {scopes.length > 1 ? (
          <form action="/admin" className="flex max-w-full flex-wrap items-end gap-2">
            <label className="grid min-w-0 max-w-full gap-1 text-sm">School or campus
              <select name="scope" defaultValue={scopeKey} className="h-10 w-full min-w-0 rounded-md border bg-white px-2">
                {scopes.map((item) => {
                  const key = schoolScopeKey(item.organizationId, item.campusId)
                  return <option value={key} key={key}>{item.label}</option>
                })}
              </select>
            </label>
            <Button type="submit" variant="outline">Apply</Button>
          </form>
        ) : null}
      </div>
      {scannersOpen ? <AttendanceQrScanner key={scopeKey} recordAction={recordSchoolAttendanceQr.bind(null, scope)} /> : (
        <div className="rounded-lg border bg-white p-4 text-sm">
          {canReview ? "Check-in has closed. Review unconfirmed students." :
            phase === "before" && schedule ? `The QR camera opens at ${minuteLabel(schedule.opensMinute)}.` :
              phase === "setup" ? "Set a school attendance schedule to use the QR camera." : "No check-in window is open."}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        {(["PRESENT", "LATE", "PENDING", "ABSENT", "EXCUSED"] as const).map((status) => (
          <Link key={status} href={`${attendancePath}&status=${status}`} className="rounded-lg border bg-white p-3 hover:border-current">
            <span className="block text-sm">{dailyLabels[status]}</span>
            <span className="block text-lg font-semibold">{countsByStatus.get(status) ?? 0}</span>
          </Link>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {canReview ? (
          <Button asChild><Link href={`${attendancePath}&status=PENDING`}>Review unconfirmed</Link></Button>
        ) : null}
        <Button asChild variant="outline">
          <Link href={phase === "setup" && !scannersOpen ? `${attendancePath}#school-attendance-schedule` : attendancePath}>
            {phase === "setup" && !scannersOpen ? "Schedule settings" : "Open attendance roster"}
          </Link>
        </Button>
        <StudentQrRefresh label="Refresh attendance" />
      </div>
    </section>
  )
}
