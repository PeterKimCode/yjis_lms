import { UserRole } from "@prisma/client"
import { requireAnyRole } from "@/modules/auth/permissions"
import { getStudentQrSessions } from "@/modules/attendance/smart-data"
import { StudentAttendanceQr, StudentQrRefresh } from "@/modules/attendance/student-qr"
import { DashboardPage } from "@/modules/dashboards/components"

export default async function StudentAttendancePage() {
  const student = await requireAnyRole([UserRole.STUDENT])
  const sessions = await getStudentQrSessions(student.id)

  return (
    <DashboardPage title="QR attendance" description="">
      <div className="space-y-4">
        <StudentQrRefresh />
        {sessions.length ? (
          <ul className="grid min-w-0 gap-4 lg:grid-cols-2">
            {sessions.map((session) => (
              <li key={session.id} className="min-w-0 space-y-3 rounded-lg border bg-white p-4">
                <h2 className="break-words font-semibold">{session.classSection.name}</h2>
                <p className="break-words text-sm text-muted-foreground">{session.title}</p>
                <StudentAttendanceQr sessionId={session.id} />
              </li>
            ))}
          </ul>
        ) : <p className="rounded-lg border bg-white p-4">You have no open QR check-ins.</p>}
      </div>
    </DashboardPage>
  )
}
