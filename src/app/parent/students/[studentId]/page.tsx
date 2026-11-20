import { HelpTooltip } from "@/components/help-tooltip"
import Link from "next/link"
import { notFound } from "next/navigation"
import { UserRole } from "@prisma/client"
import { formatDateTimeInTimeZone } from "@/lib/timezone"
import { assessmentAvailability } from "@/modules/quizzes/availability"

import { requireAnyRole } from "@/modules/auth/permissions"
import {
  DashboardPage,
  MetricCard,
  SimpleTable,
  TableCell,
  TableRow,
} from "@/modules/dashboards/components"
import {
  formatDateTime,
  getAttendancePolicyForOrganization,
  getParentStudentDetail,
} from "@/modules/dashboards/data"
import { StudentDocuments } from "@/modules/documents/student-documents"
import { effectiveSchoolSchedule, studentCampus } from "@/modules/attendance/school-data"
import { dailyLabels, minuteLabel, schoolPhase, schoolTime, type DailyStatus } from "@/modules/attendance/school-rules"
import {
  getAttendanceSummary,
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
  const attendancePolicy = await getAttendancePolicyForOrganization(student.organizationId)
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
      <SchoolAttendance student={student} />
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <MetricCard label="Classes" value={student.enrollments.length} />
        <MetricCard
          label="Class attendance rate"
          value={`${attendanceSummary.attendanceRate.toFixed(1)}%`}
        />
        <MetricCard
          label="Class present"
          value={attendanceSummary.presentCount}
        />
        <MetricCard
          label="Class late"
          value={attendanceSummary.lateCount}
        />
        <MetricCard
          label="Class absent"
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

      <div className="space-y-3 rounded-lg border bg-white p-4">
        <h2 className="text-sm font-semibold lms-help-heading">Documents<HelpTooltip>Download documents approved by the school for this linked student.</HelpTooltip></h2>
        <StudentDocuments studentId={student.id} canRequest={false} />
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
          "Boards",
          "Status",
        ]}
        rows={student.enrollments.map((enrollment) => (
          <ParentClassGradeRow enrollment={enrollment} key={enrollment.id} />
        ))}
      />

      <SimpleTable
        empty="No class attendance records yet."
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
              {formatDateTimeInTimeZone(record.checkedInAt ?? record.createdAt, record.attendanceSession.organization.timezone)}
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
                  <Link className="text-primary hover:underline" href={`/parent/students/${enrollment.studentId}/classes/${enrollment.classSectionId}`}>{enrollment.classSection.name}</Link>
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
        empty="No published exams or quizzes yet."
        headers={["Class", "Exams / Quiz", "Starts", "Ends", "Status", "Score"]}
        rows={student.enrollments.flatMap((enrollment) =>
          enrollment.classSection.quizzes.map((quiz) => {
            const attempt = quiz.attempts[0]
            const showResults = shouldShowQuizResults(quiz)

            return (
              <TableRow key={quiz.id}>
                <TableCell className="font-medium">
                  <Link className="text-primary hover:underline" href={`/parent/students/${enrollment.studentId}/classes/${enrollment.classSectionId}`}>{enrollment.classSection.name}</Link>
                </TableCell>
                <TableCell>{quiz.title}</TableCell>
                <TableCell>{formatDateTimeInTimeZone(quiz.opensAt, enrollment.classSection.organization.timezone)}</TableCell>
                <TableCell>{formatDateTimeInTimeZone(quiz.closesAt, enrollment.classSection.organization.timezone)}</TableCell>

                <TableCell>
                  {attempt ? getQuizAttemptStatus(attempt) : assessmentAvailability(quiz, quiz.attempts.length, quiz.questions.length)}
                </TableCell>
                <TableCell>
                  {attempt && showResults && getQuizAttemptStatus(attempt) === "Graded"
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
                      ? showResults ? "Results are not available yet" : "Results hidden"
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

function SchoolAttendance({ student }: { student: NonNullable<Awaited<ReturnType<typeof getParentStudentDetail>>> }) {
  const { organizationId, organization } = student
  const { timezone, schoolAttendanceRecords } = organization
  const time = schoolTime(new Date(), timezone)
  const campusId = studentCampus(student, organizationId)
  const schedule = effectiveSchoolSchedule(organization.schoolAttendanceSchedules, { organizationId, campusId })
  const phase = organization.isActive ? schoolPhase(schedule, time) : "closed-day"
  const today = schoolAttendanceRecords.find((record) => record.schoolDate === time.date)
  const recent = schoolAttendanceRecords.filter((record) => record.schoolDate < time.date).slice(0, 10)
  const todayStatus = today ? dailyLabels[today.status as DailyStatus] :
    phase === "setup" ? "School attendance has not been set up yet." :
    phase === "closed-day" ? "No school check-in scheduled today." :
    phase === "before" ? "School check-in has not opened yet." : dailyLabels.PENDING
  const checkInTime = (value: Date) => minuteLabel(schoolTime(value, timezone).minute)

  return (
    <section id="school-attendance" aria-labelledby="school-attendance-heading" className="scroll-mt-24 space-y-4 rounded-lg border bg-white p-4">
      <div className="space-y-2">
        <h2 id="school-attendance-heading" className="text-lg font-semibold">School attendance</h2>
        <p className="text-sm text-muted-foreground">Today · {time.date}</p>
        <p className="text-sm font-medium">
          {todayStatus}{today?.checkedInAt ? ` · ${checkInTime(today.checkedInAt)}` : ""}
        </p>
      </div>
      {recent.length ? (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">Recent school attendance</h3>
          <SimpleTable
            empty="No earlier school attendance records."
            headers={["School date", "Status", "Check-in time"]}
            rows={recent.map((record) => (
              <TableRow key={record.id}>
                <TableCell>{record.schoolDate}</TableCell>
                <TableCell>{dailyLabels[record.status as DailyStatus]}</TableCell>
                <TableCell>{record.checkedInAt ? checkInTime(record.checkedInAt) : "-"}</TableCell>
              </TableRow>
            ))}
          />
        </div>
      ) : null}
    </section>
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
        <Link className="text-primary hover:underline" href={`/parent/students/${enrollment.studentId}/classes/${enrollment.classSectionId}`}>{enrollment.classSection.name}</Link>
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
      <TableCell>
        {enrollment.classSection.boards.length ? (
          <div className="flex flex-col gap-1">
            {enrollment.classSection.boards.map((board) => (
              <Link
                className="text-primary underline-offset-4 hover:underline"
                href={`/parent/students/${enrollment.studentId}/classes/${enrollment.classSectionId}/boards/${board.id}`}
                key={board.id}
              >
                {board.name}
              </Link>
            ))}
          </div>
        ) : (
          "-"
        )}
      </TableCell>
      <TableCell>{grade?.status ?? "Not published"}</TableCell>
    </TableRow>
  )
}
