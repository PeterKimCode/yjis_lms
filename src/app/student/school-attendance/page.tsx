import { UserRole } from "@prisma/client"
import { getPrismaClient } from "@/lib/prisma"
import { requireAnyRole } from "@/modules/auth/permissions"
import { issueSchoolAttendanceQr } from "@/modules/attendance/school-actions"
import { getDailyStudentContext } from "@/modules/attendance/school-data"
import { dailyLabels, minuteLabel, schoolPhase, schoolTime } from "@/modules/attendance/school-rules"
import { StudentAttendanceQr, StudentQrRefresh } from "@/modules/attendance/student-qr"
import { DashboardPage } from "@/modules/dashboards/components"

export default async function StudentSchoolAttendancePage() {
  await requireAnyRole([UserRole.STUDENT])
  const context = await getDailyStudentContext()
  if (!context) return <DashboardPage title="School attendance" description=""><p>No active school attendance is available for your account.</p></DashboardPage>
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
    <DashboardPage title="School attendance" description="">
      <section className="max-w-2xl space-y-4 rounded-lg border bg-white p-4">
        <div>
          <h2 className="break-words text-lg font-semibold">{school.name}</h2>
          <p className="text-sm text-muted-foreground">{time.date}</p>
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
        <StudentQrRefresh label="Refresh attendance" />
      </section>
    </DashboardPage>
  )
}
