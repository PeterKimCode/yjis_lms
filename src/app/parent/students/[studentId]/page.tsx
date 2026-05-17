import Link from "next/link"
import { notFound } from "next/navigation"
import { UserRole } from "@prisma/client"

import { Button } from "@/components/ui/button"
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
import {
  getQuizAttemptStatus,
  shouldShowQuizResults,
} from "@/modules/quizzes/status"

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
  const termOptions = [
    ...new Map(
      student.enrollments
        .map((enrollment) => enrollment.classSection.term)
        .filter((term): term is NonNullable<typeof term> => Boolean(term))
        .map((term) => [term.id, term])
    ).values(),
  ]

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

      <div className="rounded-lg border bg-background p-4">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold">Documents</h2>
          <p className="text-sm text-muted-foreground">
            Download published or finalized documents for this linked student.
          </p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href={`/api/documents/transcript?studentId=${student.id}`}>
              Download transcript
            </Link>
          </Button>
          {termOptions.length ? (
            termOptions.map((term) => (
              <Button asChild key={term.id} size="sm" variant="outline">
                <Link
                  href={`/api/documents/report-card?studentId=${student.id}&termId=${term.id}`}
                >
                  Report card: {term.name}
                </Link>
              </Button>
            ))
          ) : (
            <Button asChild size="sm" variant="outline">
              <Link href={`/api/documents/report-card?studentId=${student.id}`}>
                Download report card
              </Link>
            </Button>
          )}
        </div>
      </div>

      <SimpleTable
        empty="No enrolled classes yet."
        headers={[
          "Class",
          "Course",
          "Term",
          "Campus",
          "Final score",
          "Letter",
          "Grade point",
          "Credit",
          "Status",
        ]}
        rows={student.enrollments.map((enrollment) => (
          <ParentClassGradeRow enrollment={enrollment} key={enrollment.id} />
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

      <SimpleTable
        empty="No quizzes yet."
        headers={["Class", "Quiz", "Close", "Status", "Score"]}
        rows={student.enrollments.flatMap((enrollment) =>
          enrollment.classSection.quizzes.map((quiz) => {
            const attempt = quiz.attempts[0]
            const showResults = shouldShowQuizResults(quiz)

            return (
              <TableRow key={quiz.id}>
                <TableCell className="font-medium">
                  {enrollment.classSection.name}
                </TableCell>
                <TableCell>{quiz.title}</TableCell>
                <TableCell>{formatDateTime(quiz.closesAt)}</TableCell>
                <TableCell>
                  {attempt ? getQuizAttemptStatus(attempt) : "Not started"}
                </TableCell>
                <TableCell>
                  {attempt && showResults
                    ? `${attempt.score?.toString() ?? "0"}/${
                        quiz.pointsPossible?.toString() ??
                        quiz.questions
                          .reduce(
                            (total, question) => total + Number(question.points),
                            0
                          )
                          .toFixed(2)
                      }`
                    : attempt
                      ? "Results hidden"
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

function ParentClassGradeRow({
  enrollment,
}: {
  enrollment: NonNullable<
    Awaited<ReturnType<typeof getParentStudentDetail>>
  >["enrollments"][number]
}) {
  const grade = enrollment.classSection.finalGrades[0]

  return (
    <TableRow>
      <TableCell className="font-medium">
        {enrollment.classSection.name}
      </TableCell>
      <TableCell>{enrollment.classSection.course.title}</TableCell>
      <TableCell>{enrollment.classSection.term?.name ?? "No term"}</TableCell>
      <TableCell>
        {enrollment.classSection.campus?.name ?? "Organization-wide"}
      </TableCell>
      <TableCell>
        {grade?.percentage?.toString() ?? grade?.numericScore?.toString() ?? "-"}
      </TableCell>
      <TableCell>{grade?.letterGrade ?? "-"}</TableCell>
      <TableCell>{grade?.gradePoint?.toString() ?? "-"}</TableCell>
      <TableCell>{grade?.creditsEarned?.toString() ?? "0"}</TableCell>
      <TableCell>{grade?.status ?? "Not published"}</TableCell>
    </TableRow>
  )
}
