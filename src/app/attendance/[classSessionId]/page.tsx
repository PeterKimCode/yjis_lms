import Link from "next/link"
import { notFound } from "next/navigation"
import { AttendanceStatus, DeliveryMode, UserRole } from "@prisma/client"
import { Button } from "@/components/ui/button"
import { getPrismaClient } from "@/lib/prisma"
import { formatDateTimeInTimeZone } from "@/lib/timezone"
import { requireAuth } from "@/modules/auth/permissions"
import { AttendanceQrScanner } from "@/modules/attendance/qr-scanner"
import { SmartAttendanceEdit, SmartSessionControls } from "@/modules/attendance/smart-controls"
import { activeAttendanceEnrollment, getSmartAttendanceManager } from "@/modules/attendance/smart-data"
import { isQrOpen, suggestedStatus } from "@/modules/attendance/smart-rules"
import { attendanceLabels } from "@/modules/attendance/smart-shared"
import { DashboardPage } from "@/modules/dashboards/components"
import { resolvePolicies } from "@/modules/policies/resolve"

export default async function AttendanceManagerPage({ params }: { params: Promise<{ classSessionId: string }> }) {
  await requireAuth()
  const { classSessionId } = await params
  const prisma = getPrismaClient()
  const meeting = await prisma.classSession.findUnique({
    where: { id: classSessionId },
    select: {
      classSectionId: true, organizationId: true, campusId: true, deliveryMode: true,
      title: true, startsAt: true, classSection: { select: { name: true } },
      organization: { select: { timezone: true } }, attendanceSession: true,
    },
  })
  if (!meeting) notFound()
  const actor = await getSmartAttendanceManager(meeting.classSectionId)
  if (!actor) notFound()
  const adminRoles: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.SCHOOL_ADMIN, UserRole.ACADEMIC_STAFF]
  const isAdmin = actor.roleAssignments.some(({ role }) => adminRoles.includes(role))
  const back = isAdmin ? "/admin/attendance" : `/instructor/classes/${meeting.classSectionId}?tab=attendance&view=sessions`
  const time = (value: Date | null) => formatDateTimeInTimeZone(value, meeting.organization.timezone)
  const session = meeting.attendanceSession
  const now = new Date()
  const open = !!session && isQrOpen(session, now)
  const published = !!session?.qrFinalizedAt
  const available = !session && meeting.deliveryMode !== DeliveryMode.ONLINE
  const [rows, records, { attendance: policy }, enrollments] = await Promise.all([
    session?.qrOpenedAt ? prisma.smartAttendanceCheckIn.findMany({
      where: { attendanceSessionId: session.id }, include: { student: { select: { name: true } } },
      orderBy: [{ student: { name: "asc" } }, { studentId: "asc" }],
    }) : [],
    published ? prisma.attendanceRecord.findMany({ where: { attendanceSessionId: session!.id } }) : [],
    resolvePolicies(meeting),
    session?.qrOpenedAt && !published ? prisma.enrollment.findMany({
      where: activeAttendanceEnrollment(meeting.classSectionId), select: { studentId: true },
    }) : [],
  ])
  const byStudent = new Map(records.map((record) => [record.studentId, record]))
  const activeIds = new Set(enrollments.map(({ studentId }) => studentId))
  const roster = rows.filter((row) => published ? byStudent.has(row.studentId) : activeIds.has(row.studentId))
    .map((row) => {
      const record = byStudent.get(row.studentId)
      const status = record?.status ?? row.reviewStatus ?? suggestedStatus(row.verifiedAt, session?.qrLateAt ?? null)
      return { ...row, status, note: record?.note ?? row.reviewNote }
    })
  const verified = roster.filter((row) => row.verifiedAt).length
  const late = roster.filter((row) => row.status === AttendanceStatus.LATE).length
  const absent = roster.filter((row) => row.status === AttendanceStatus.ABSENT).length

  return (
    <DashboardPage title="QR attendance" description="">
      <div className="space-y-4">
        <Button asChild variant="outline"><Link href={back}>{isAdmin ? "Back to attendance" : "Back to class sessions"}</Link></Button>
        <section className="space-y-3 rounded-lg border bg-white p-4" aria-label="Attendance session">
          <div>
            <h2 className="break-words text-lg font-semibold">{meeting.classSection.name}</h2>
            <p className="break-words text-sm text-muted-foreground">{meeting.title ?? "Class session"} · {time(meeting.startsAt)}</p>
          </div>
          {available ? <SmartSessionControls classSessionId={classSessionId} phase="setup" /> : null}
          {!session && !available ? <p>QR check-in is available for in-person or hybrid sessions.</p> : null}
          {session && !session.qrOpenedAt ? <p>This session uses manual attendance.</p> : null}
          {open ? <>
            <h2 className="font-semibold">Check-in is open until {time(session?.qrClosesAt ?? null)}</h2>
            <SmartSessionControls classSessionId={classSessionId} phase="open" closesInMs={session!.qrClosesAt!.getTime() - now.getTime()} />
          </> : null}
          {session?.qrOpenedAt && !open && !published ? <>
            <h2 className="font-semibold">Review attendance</h2>
            <p className="text-sm">Unverified students are marked absent unless you save a different status.</p>
            <SmartSessionControls classSessionId={classSessionId} phase="review" rosterCount={roster.length} />
          </> : null}
          {published ? <p className="font-semibold">Published {time(session?.qrFinalizedAt ?? null)}</p> : null}
        </section>
        {open ? <AttendanceQrScanner classSessionId={classSessionId} /> : null}
        {session?.qrOpenedAt ? (
          <section className="space-y-3" aria-label="Student roster">
            <h2 className="text-lg font-semibold">Student roster</h2>
            <p className="text-sm">
              {verified} / {roster.length} QR verified · {late} late · {absent} {published ? "absent" : "suggested absent"}
            </p>
            {roster.length ? <ul className="grid gap-3 lg:grid-cols-2">
              {roster.map((row) => (
                <li key={row.studentId} className="min-w-0 space-y-3 rounded-lg border bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="min-w-0 break-words font-semibold">{row.student.name}</h3>
                    <span className="rounded-full border bg-background px-2 py-1 text-xs font-medium">{attendanceLabels[row.status]}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {row.verifiedAt ? `QR verified · ${time(row.verifiedAt)}` : "QR not verified"}
                    {row.reviewStatus ? " · Manually reviewed" : ""}
                  </p>
                  {policy.allowInstructorOverride ? (
                    <SmartAttendanceEdit
                      key={`${published}:${row.reviewStatus}:${row.note}`}
                      classSessionId={classSessionId} studentId={row.studentId} studentName={row.student.name}
                      status={published ? row.status : row.reviewStatus} note={row.note} published={published}
                    />
                  ) : row.note ? <p className="break-words text-sm">{row.note}</p> : null}
                </li>
              ))}
            </ul> : <p className="text-sm">There are no students to review.</p>}
          </section>
        ) : null}
      </div>
    </DashboardPage>
  )
}
