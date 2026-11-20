import { UserRole } from "@prisma/client"
import { getPrismaClient } from "@/lib/prisma"
import { requireAnyRole } from "@/modules/auth/permissions"
import { issueSchoolAttendanceQr } from "@/modules/attendance/school-actions"
import { getDailyStudentContext } from "@/modules/attendance/school-data"
import { dailyLabels, minuteLabel, schoolPhase, schoolTime } from "@/modules/attendance/school-rules"
import { StudentAttendanceQr, StudentQrRefresh } from "@/modules/attendance/student-qr"
import { getStudentQrSessions } from "@/modules/attendance/smart-data"
import { DashboardPage } from "@/modules/dashboards/components"

export default async function StudentSchoolAttendancePage() {
  const student = await requireAnyRole([UserRole.STUDENT])
  const [context, sessions] = await Promise.all([getDailyStudentContext(), getStudentQrSessions(student.id)])

  return (
    <DashboardPage title="School attendance" description="" actions={<StudentQrRefresh label="Refresh attendance" />}>
      <div className="space-y-6">
        {context ? <DailySchoolCheckIn context={context} /> :
          <p className="rounded-lg border bg-white p-4">No active school check-in is available for your account.</p>}
        <section id="class-qr" aria-labelledby="class-qr-heading" className="scroll-mt-24 space-y-3">
          <h2 id="class-qr-heading" className="text-lg font-semibold">Class QR check-ins</h2>
          {sessions.length ? (
            <ul className="grid min-w-0 gap-4 lg:grid-cols-2">
              {sessions.map((session) => (
                <li key={session.id} className="min-w-0 space-y-3 rounded-lg border bg-white p-4">
                  <h3 className="break-words font-semibold">{session.classSection.name}</h3>
                  <p className="break-words text-sm text-muted-foreground">{session.title}</p>
                  <StudentAttendanceQr sessionId={session.id} />
                </li>
              ))}
            </ul>
          ) : <p className="rounded-lg border bg-white p-4">You have no open class QR check-ins.</p>}
        </section>
      </div>
    </DashboardPage>
  )
}

async function DailySchoolCheckIn({ context }: { context: NonNullable<Awaited<ReturnType<typeof getDailyStudentContext>>> }) {
  const { student, school, schedule } = context
  const time = schoolTime(new Date(), school.timezone)
  const phase = schoolPhase(schedule, time)
  const record = await getPrismaClient().schoolAttendanceRecord.findUnique({
    where: { organizationId_studentId_schoolDate: { organizationId: school.id, studentId: student.id, schoolDate: time.date } },
    select: { status: true },
  })
  const status = record?.status as keyof typeof dailyLabels | undefined
  const recorded = status && status !== "PENDING"
  const message = phase === "setup" ? "Your school has not set up daily attendance yet." :
    phase === "closed-day" ? "No school check-in is scheduled today." :
    phase === "before" ? `Today’s check-in opens at ${minuteLabel(schedule!.opensMinute)}.` :
    phase === "review" ? "Check-in has closed. Your school's attendance staff will review unconfirmed records." : ""
  return (
      <section className="max-w-2xl space-y-4 rounded-lg border bg-white p-4" aria-labelledby="daily-school-check-in">
        <div>
          <h2 id="daily-school-check-in" className="text-lg font-semibold">Daily school check-in</h2>
          <p className="break-words text-sm text-muted-foreground">{school.name} · {time.date}</p>
        </div>
        {recorded ? <p className="font-medium">Today’s status · {dailyLabels[status]}</p> :
          phase === "open" ? <>
            <p className="text-sm">Check-in closes at {minuteLabel(schedule!.closesMinute)}.</p>
            <StudentAttendanceQr
              key={time.date} sessionId={time.date} issueAction={issueSchoolAttendanceQr}
              verifiedMessage="Your school check-in has been recorded."
              prompt="Show this screen to the school attendance staff. The QR changes every 12 seconds."
            />
          </> : <p>{message}</p>}
      </section>
  )
}
