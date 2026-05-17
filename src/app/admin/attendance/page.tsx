import { getPrismaClient } from "@/lib/prisma"
import {
  getClassSectionWhereForAdmin,
  requireAdmin,
} from "@/modules/admin/access"
import {
  AdminPageHeader,
  DataTable,
  SearchForm,
  TableCell,
  TableRow,
  matchesSearch,
} from "@/modules/admin/components"
import {
  getAttendanceSummary,
  normalizeAttendancePolicy,
} from "@/modules/attendance/summary"

export default async function AdminAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const admin = await requireAdmin()
  const q = (await searchParams).q?.trim() ?? ""
  const sessions = await getPrismaClient().attendanceSession.findMany({
    where: {
      classSection: getClassSectionWhereForAdmin(admin),
    },
    include: {
      classSection: {
        include: {
          campus: true,
          course: true,
          term: true,
        },
      },
      classSession: true,
      records: {
        include: {
          student: true,
        },
      },
    },
    orderBy: { takenAt: "desc" },
  })
  const records = sessions.flatMap((session) => session.records)
  const summary = getAttendanceSummary(records, normalizeAttendancePolicy(null))
  const recordRows = sessions.flatMap((session) =>
    session.records.map((record) => ({
      id: record.id,
      className: session.classSection.name,
      courseName: session.classSection.course.title,
      termName: session.classSection.term?.name ?? "No term",
      campusName: session.classSection.campus?.name ?? "Organization-wide",
      studentName: record.student.name,
      studentEmail: record.student.email ?? "-",
      status: record.status,
      takenAt: session.takenAt,
    }))
  )
  const filteredRows = recordRows.filter((row) =>
    matchesSearch(q, [
      row.className,
      row.courseName,
      row.termName,
      row.campusName,
      row.studentName,
      row.studentEmail,
      row.status,
    ])
  )

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Attendance"
        description="Scoped attendance overview by class, student, term, and campus."
      />
      <SearchForm q={q} placeholder="Search attendance, classes, students..." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryCard label="Total sessions" value={sessions.length} />
        <SummaryCard label="Present" value={summary.presentCount} />
        <SummaryCard label="Late" value={summary.lateCount} />
        <SummaryCard label="Absent" value={summary.absentCount} />
        <SummaryCard
          label="Attendance rate"
          value={`${summary.attendanceRate.toFixed(1)}%`}
        />
      </div>
      <DataTable
        empty="No attendance sessions are available for your scope."
        headers={["Class", "Student", "Status", "Course", "Term", "Campus", "Taken"]}
        minWidth="min-w-[900px]"
        rows={filteredRows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="font-medium">{row.className}</TableCell>
            <TableCell>
              <div className="font-medium">{row.studentName}</div>
              <div className="text-xs text-muted-foreground">{row.studentEmail}</div>
            </TableCell>
            <TableCell>{row.status}</TableCell>
            <TableCell>{row.courseName}</TableCell>
            <TableCell>{row.termName}</TableCell>
            <TableCell>{row.campusName}</TableCell>
            <TableCell>{row.takenAt.toLocaleString()}</TableCell>
          </TableRow>
        ))}
      />
    </div>
  )
}

function SummaryCard({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  )
}
