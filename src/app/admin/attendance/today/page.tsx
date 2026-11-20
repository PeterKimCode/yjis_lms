import Link from "next/link"
import { notFound } from "next/navigation"
import type { Prisma } from "@prisma/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getPrismaClient } from "@/lib/prisma"
import { requireAdmin } from "@/modules/admin/access"
import { AdminPageHeader } from "@/modules/admin/components"
import { AdminAttendanceTabs } from "@/modules/attendance/admin-tabs"
import { AttendanceQrScanner } from "@/modules/attendance/qr-scanner"
import { confirmSchoolAttendance, inspectSchoolAttendanceQr } from "@/modules/attendance/school-actions"
import { DailyAbsenceReview, DailyAttendanceEdit, SchoolScheduleForm } from "@/modules/attendance/school-controls"
import { dailyStudentSelect, effectiveSchoolSchedule, getSchoolAttendanceScopes, getSchoolSchedules, schoolStudents, studentCampus } from "@/modules/attendance/school-data"
import { dailyLabels, dailyStatuses, minuteLabel, schoolPhase, schoolScopeKey, schoolTime } from "@/modules/attendance/school-rules"
import { StudentQrRefresh } from "@/modules/attendance/student-qr"

const base = "/admin/attendance/today"
const pageSize = 24
const selectClass = "h-10 min-w-0 w-full rounded-md border bg-white px-2 text-sm"

function read(value: string | string[] | undefined, max = 120) {
  return typeof value === "string" ? value.trim().slice(0, max) : ""
}

export default async function SchoolAttendanceToday({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const admin = await requireAdmin()
  const query = await searchParams
  const scopes = await getSchoolAttendanceScopes(admin.roleAssignments)
  const requested = read(query.scope)
  const selected = requested ? scopes.find((scope) => schoolScopeKey(scope.organizationId, scope.campusId) === requested) :
    scopes.find(({ organizationId }) => organizationId === admin.organizationId) ?? scopes[0]
  if (requested && !selected) notFound()
  if (!selected) return <div className="space-y-4"><AdminAttendanceTabs view="today" /><p>No active schools or campuses are in your scope.</p></div>
  const scope = { organizationId: selected.organizationId, campusId: selected.campusId }
  const scopeKey = schoolScopeKey(scope.organizationId, scope.campusId)
  const url = (params: Record<string, string> = {}) => `${base}?${new URLSearchParams({ scope: scopeKey, ...params })}`
  const schedules = await getSchoolSchedules(scope.organizationId)
  const schedule = effectiveSchoolSchedule(schedules, scope)
  const hasOverride = schedules.some((item) => item.scopeKey === scopeKey)
  const now = new Date()
  const time = schoolTime(now, selected.timezone)
  const phase = schoolPhase(schedule, time)
  const scheduled = (value: ReturnType<typeof schoolPhase>) => value !== "setup" && value !== "closed-day"
  const prs = getPrismaClient()
  const header = (
    <>
      <AdminPageHeader title="School attendance" description="" />
      <AdminAttendanceTabs view="today" />
      <div className="rounded-lg border bg-white p-4">
        <form action={base} className="flex min-w-0 flex-wrap items-end gap-2">
          <label className="grid min-w-0 max-w-full gap-1 text-sm font-medium">School or campus
            <select name="scope" defaultValue={scopeKey} className={selectClass}>
              {scopes.map((item) => {
                const key = schoolScopeKey(item.organizationId, item.campusId)
                return <option key={key} value={key}>{item.label}</option>
              })}
            </select>
          </label>
          <Button variant="outline" type="submit">Apply</Button>
        </form>
      </div>
    </>
  )
  const q = read(query.q)
  const grade = read(query.grade, 80)
  const homeroom = read(query.homeroom, 80)
  const filter = (["PENDING", ...dailyStatuses] as const).find((status) => status === query.status)
  const requestedPage = Number(read(query.page, 5))
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 1000) : 1
  const recordOnDay = { organizationId: scope.organizationId, schoolDate: time.date }
  const settled = { ...recordOnDay, status: { in: [...dailyStatuses] } }
  const campusOverrides = scope.campusId ? [] : schedules.filter(({ campusId }) => campusId)
  const scheduledOverrideIds = campusOverrides.filter((item) => scheduled(schoolPhase(item, time))).map((item) => item.campusId!)
  const campusProfile = (ids: string[]): Prisma.StudentProfileWhereInput => ({
    organizationId: scope.organizationId, campusId: { in: ids }, campus: { isActive: true, organizationId: scope.organizationId },
  })
  const schoolDay: Prisma.UserWhereInput = {
    OR: [
      { schoolAttendanceRecords: { some: settled } },
      { studentProfile: campusProfile(scheduledOverrideIds) },
      ...(scheduled(phase) ? [{ NOT: { studentProfile: campusProfile(campusOverrides.map((item) => item.campusId!)) } }] : []),
    ],
  }
  const people: Prisma.UserWhereInput = {
    ...schoolStudents(scope, now),
    AND: [
      schoolDay,
      ...(q ? [{ name: { contains: q, mode: "insensitive" as const } }] : []),
      ...(grade || homeroom ? [{ studentProfile: { ...(grade ? { currentGradeLevelId: grade } : {}), ...(homeroom ? { homeroomId: homeroom } : {}) } }] : []),
    ],
  }
  const statusWhere: Prisma.UserWhereInput = filter === "PENDING" ? { schoolAttendanceRecords: { none: settled } } :
    filter ? { schoolAttendanceRecords: { some: { ...recordOnDay, status: filter } } } : {}
  const placementScope = {
    organizationId: scope.organizationId,
    ...(scope.campusId ? { OR: [{ campusId: scope.campusId }, { campusId: null }] } : {}),
  }
  const [total, counts, students, grades, homerooms] = await Promise.all([
    prs.user.count({ where: people }),
    prs.schoolAttendanceRecord.groupBy({
      by: ["status"], where: { ...settled, student: people }, _count: { _all: true },
    }),
    prs.user.findMany({
      where: { AND: [people, statusWhere] }, orderBy: [{ name: "asc" }, { id: "asc" }],
      skip: (page - 1) * pageSize, take: pageSize + 1,
      select: {
        ...dailyStudentSelect,
        schoolAttendanceRecords: {
          where: recordOnDay, take: 1,
          select: { status: true, checkedInAt: true, note: true, updatedById: true, updatedAt: true },
        },
      },
    }),
    prs.gradeLevel.findMany({ where: placementScope, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prs.homeroom.findMany({ where: placementScope, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ])
  const summaries = new Map(counts.map((item) => [item.status, item._count._all]))
  summaries.set("PENDING", total - counts.reduce((sum, count) => sum + count._count._all, 0))
  const rows = students.slice(0, pageSize).map((student) => {
    const campusId = studentCampus(student, scope.organizationId)
    const studentPhase = schoolPhase(effectiveSchoolSchedule(schedules, { ...scope, campusId }), time)
    const record = student.schoolAttendanceRecords[0]
    return { student, record, studentPhase, status: (record?.status ?? "PENDING") as keyof typeof dailyLabels }
  })
  const staffIds = [...new Set(rows.flatMap(({ record }) => record?.updatedById ? [record.updatedById] : []))]
  const staff = new Map((staffIds.length ? await prs.user.findMany({
    where: { id: { in: staffIds } }, select: { id: true, name: true },
  }) : []).map(({ id, name }) => [id, name]))
  const pendingIds = rows.filter(({ studentPhase, status }) => studentPhase === "review" && status === "PENDING").map(({ student }) => student.id)
  const scannersOpen = phase === "open" || campusOverrides.some((item) => schoolPhase(item, time) === "open")
  const paging = { q, grade, homeroom, status: filter ?? "" }

  return (
    <div className="space-y-4">
      {header}
      <section aria-labelledby="school-attendance-schedule" className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="school-attendance-schedule" className="text-lg font-semibold">Schedule settings</h2>
          {scope.campusId && !hasOverride && schedule ? <p className="text-sm text-muted-foreground">Using the school schedule</p> : null}
        </div>
        <SchoolScheduleForm key={`${scopeKey}:${JSON.stringify(schedule)}`} scope={scope} schedule={schedule} hasOverride={hasOverride} />
      </section>
      <section className="space-y-2 rounded-lg border bg-white p-4">
        <h2 className="break-words font-semibold">{selected.label} · {time.date}</h2>
        {schedule ? <p className="text-sm">Default check-in {minuteLabel(schedule.opensMinute)}–{minuteLabel(schedule.closesMinute)} · Late from {minuteLabel(schedule.lateMinute)}{!scope.campusId && campusOverrides.length ? " · Some campuses have their own hours" : ""}</p>
          : <p className="text-sm">Set school or campus hours to begin daily attendance.</p>}
        <StudentQrRefresh label="Refresh attendance" />
      </section>
      {scannersOpen ? <AttendanceQrScanner
        key={scopeKey} classSessionId={scopeKey}
        inspectAction={inspectSchoolAttendanceQr.bind(null, scope)}
        confirmAction={confirmSchoolAttendance.bind(null, scope)}
      /> : null}
      <form action={base} className="grid gap-2 rounded-lg border bg-white p-3 sm:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,1fr))_auto] xl:items-end">
        <input type="hidden" name="scope" value={scopeKey} />
        <label className="grid gap-1 text-sm">Student name
          <Input name="q" defaultValue={q} maxLength={120} className="h-10 bg-white" />
        </label>
        <label className="grid gap-1 text-sm">
          <span id="school-attendance-grade">Grade</span>
          <select name="grade" aria-labelledby="school-attendance-grade" defaultValue={grade} className={selectClass}>
            <option value="">All grades</option>
            {grades.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span id="school-attendance-homeroom">Homeroom</span>
          <select name="homeroom" aria-labelledby="school-attendance-homeroom" defaultValue={homeroom} className={selectClass}>
            <option value="">All homerooms</option>
            {homerooms.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span id="school-attendance-status">Status</span>
          <select name="status" aria-labelledby="school-attendance-status" defaultValue={filter ?? ""} className={selectClass}>
            <option value="">All statuses</option>
            {(["PENDING", ...dailyStatuses] as const).map((status) => <option key={status} value={status}>{dailyLabels[status]}</option>)}
          </select>
        </label>
        <Button variant="outline" type="submit">Filter</Button>
      </form>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        {(["PRESENT", "LATE", "PENDING", "ABSENT", "EXCUSED"] as const).map((status) => (
          <Link key={status} href={url({ ...paging, status })} aria-current={filter === status ? "page" : undefined} className="rounded-lg border bg-white p-3 hover:border-current">
            <p className="text-sm">{dailyLabels[status]}</p><p className="text-lg font-semibold">{summaries.get(status) ?? 0}</p>
          </Link>
        ))}
      </div>
      <DailyAbsenceReview key={`${url(paging)}:${page}:${time.date}`} scope={scope} schoolDate={time.date} studentIds={pendingIds} />
      {rows.length ? <ul className="grid gap-3 xl:grid-cols-2">
        {rows.map(({ student, status, record, studentPhase }) => (
          <li key={student.id} className="min-w-0 space-y-2 rounded-lg border bg-white p-4">
            <div className="flex flex-wrap justify-between gap-2">
              <h3 className="break-words font-semibold">{student.name}</h3>
              <span className="rounded-full border px-2 py-1 text-xs">{dailyLabels[status]}</span>
            </div>
            <p className="break-words text-sm text-muted-foreground">{[student.studentProfile?.campus?.name, student.studentProfile?.currentGradeLevel?.name, student.studentProfile?.homeroom?.name].filter(Boolean).join(" · ")}</p>
            {record?.checkedInAt ? <p className="text-sm">Checked in {minuteLabel(schoolTime(record.checkedInAt, selected.timezone).minute)}</p> : null}
            {record?.updatedById ? (
              <p className="break-words text-sm text-muted-foreground">
                Recorded by {staff.get(record.updatedById) ?? "School staff"} · {minuteLabel(schoolTime(record.updatedAt, selected.timezone).minute)}
              </p>
            ) : null}
            {record?.note ? <p className="break-words text-sm">{record.note}</p> : null}
            {scheduled(studentPhase) ? (
              <DailyAttendanceEdit key={`${time.date}:${student.id}:${status}:${record?.note ?? ""}`} scope={scope}
                schoolDate={time.date} studentId={student.id} studentName={student.name}
                status={status} note={record?.note ?? null} canConfirmAbsence={studentPhase === "review"} />
            ) : null}
          </li>
        ))}
      </ul> : <p className="rounded-lg border bg-white p-4">No students match today’s schedule and filters.</p>}
      <nav aria-label="School attendance pages" className="flex flex-wrap gap-2">
        {page > 1 ? <Button asChild variant="outline"><Link href={url({ ...paging, page: String(page - 1) })}>Previous</Link></Button> : null}
        {students.length > pageSize ? <Button asChild variant="outline"><Link href={url({ ...paging, page: String(page + 1) })}>Next</Link></Button> : null}
      </nav>
    </div>
  )
}
