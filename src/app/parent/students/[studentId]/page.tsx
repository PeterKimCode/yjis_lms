import { notFound } from "next/navigation"
import { UserRole } from "@prisma/client"

import { requireAnyRole } from "@/modules/auth/permissions"
import {
  DashboardPage,
  MetricCard,
  SimpleTable,
  TableCell,
  TableRow,
} from "@/modules/dashboards/components"
import {
  formatDate,
  formatDateTime,
  getParentStudentDetail,
} from "@/modules/dashboards/data"

export default async function ParentStudentDetailPage({
  params,
}: {
  params: Promise<{ studentId: string }>
}) {
  const parent = await requireAnyRole([UserRole.PARENT])
  const { studentId } = await params
  const student = await getParentStudentDetail(parent.id, studentId)

  if (!student) {
    notFound()
  }

  return (
    <DashboardPage
      title={student.name}
      description={`${student.studentProfile?.currentGradeLevel?.name ?? "No grade"} · ${
        student.studentProfile?.campus?.name ?? "Organization-wide"
      }`}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="Classes" value={student.enrollments.length} />
        <MetricCard
          label="Recent attendance"
          value={student.attendanceRecords.length}
        />
        <MetricCard
          label="Final grades"
          value={student.enrollments.reduce(
            (total, item) => total + item.classSection.finalGrades.length,
            0
          )}
        />
      </div>

      <SimpleTable
        empty="No enrolled classes yet."
        headers={["Class", "Course", "Term", "Campus", "Grades"]}
        rows={student.enrollments.map((enrollment) => (
          <TableRow key={enrollment.id}>
            <TableCell className="font-medium">
              {enrollment.classSection.name}
            </TableCell>
            <TableCell>{enrollment.classSection.course.title}</TableCell>
            <TableCell>{enrollment.classSection.term?.name ?? "No term"}</TableCell>
            <TableCell>
              {enrollment.classSection.campus?.name ?? "Organization-wide"}
            </TableCell>
            <TableCell>
              {enrollment.classSection.finalGrades
                .map((grade) => grade.letterGrade ?? grade.percentage?.toString())
                .filter(Boolean)
                .join(", ") || "-"}
            </TableCell>
          </TableRow>
        ))}
      />

      <SimpleTable
        empty="No attendance records yet."
        headers={["Class", "Status", "Date"]}
        rows={student.attendanceRecords.map((record) => (
          <TableRow key={record.id}>
            <TableCell className="font-medium">
              {record.attendanceSession.classSection.course.title}
            </TableCell>
            <TableCell>{record.status}</TableCell>
            <TableCell>
              {formatDateTime(record.checkedInAt) || formatDate(record.createdAt)}
            </TableCell>
          </TableRow>
        ))}
      />
    </DashboardPage>
  )
}
