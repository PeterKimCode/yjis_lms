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
  getAttendancePolicyForOrganization,
  getParentStudentDetail,
} from "@/modules/dashboards/data"
import {
  getAttendanceSummary,
  normalizeAttendancePolicy,
} from "@/modules/attendance/summary"
import { getSubmissionStatus } from "@/modules/assignments/status"

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
  const attendancePolicy = normalizeAttendancePolicy(
    await getAttendancePolicyForOrganization(student.organizationId)
  )
  const attendanceSummary = getAttendanceSummary(
    student.attendanceRecords,
    attendancePolicy
  )

  return (
    <DashboardPage
      title={student.name}
      description={`${student.studentProfile?.currentGradeLevel?.name ?? "No grade"} · ${
        student.studentProfile?.campus?.name ?? "Organization-wide"
      }`}
    >
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <MetricCard label="Classes" value={student.enrollments.length} />
        <MetricCard
          label="Attendance rate"
          value={`${attendanceSummary.attendanceRate.toFixed(1)}%`}
        />
        <MetricCard
          label="Present"
          value={attendanceSummary.presentCount}
        />
        <MetricCard
          label="Late"
          value={attendanceSummary.lateCount}
        />
        <MetricCard
          label="Absent"
          value={attendanceSummary.absentCount}
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
        headers={["Class", "Term", "Campus", "Status", "Date"]}
        rows={student.attendanceRecords.map((record) => (
          <TableRow key={record.id}>
            <TableCell className="font-medium">
              {record.attendanceSession.classSection.course.title}
            </TableCell>
            <TableCell>
              {record.attendanceSession.classSection.term?.name ?? "No term"}
            </TableCell>
            <TableCell>
              {record.attendanceSession.classSection.campus?.name ??
                "Organization-wide"}
            </TableCell>
            <TableCell>{record.status}</TableCell>
            <TableCell>
              {formatDateTime(record.checkedInAt) || formatDate(record.createdAt)}
            </TableCell>
          </TableRow>
        ))}
      />

      <SimpleTable
        empty="No assignments yet."
        headers={[
          "Class",
          "Assignment",
          "Due",
          "Status",
          "Submitted",
          "Attachment",
          "Score",
        ]}
        rows={student.enrollments.flatMap((enrollment) =>
          enrollment.classSection.assignments.map((assignment) => {
            const submission = assignment.submissions[0]

            return (
              <TableRow key={assignment.id}>
                <TableCell className="font-medium">
                  {enrollment.classSection.name}
                </TableCell>
                <TableCell>{assignment.title}</TableCell>
                <TableCell>{formatDateTime(assignment.dueAt)}</TableCell>
                <TableCell>
                  {getSubmissionStatus({
                    dueAt: assignment.dueAt,
                    score: submission?.score,
                    submittedAt: submission?.submittedAt,
                  })}
                </TableCell>
                <TableCell>{formatDateTime(submission?.submittedAt)}</TableCell>
                <TableCell>
                  {submission?.attachments.length
                    ? submission.attachments.map((attachment) => (
                        <a
                          className="block max-w-[220px] truncate text-primary underline-offset-4 hover:underline"
                          href={`/api/files/${attachment.id}/download`}
                          key={attachment.id}
                          title={attachment.originalName}
                        >
                          {attachment.originalName}
                        </a>
                      ))
                    : "-"}
                </TableCell>
                <TableCell>
                  {submission?.score
                    ? `${submission.score.toString()}/${
                        assignment.pointsPossible?.toString() ?? "-"
                      }`
                    : "-"}
                </TableCell>
              </TableRow>
            )
          })
        )}
      />
    </DashboardPage>
  )
}
