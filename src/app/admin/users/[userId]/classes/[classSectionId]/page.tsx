import Link from "next/link"
import { notFound } from "next/navigation"
import type { ReactNode } from "react"
import { AttendanceStatus } from "@prisma/client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  AdminPageHeader,
  DataTable,
  TableCell,
  TableRow,
} from "@/modules/admin/components"
import {
  formatDateTime,
  getAdminStudentClassRecord,
} from "@/modules/admin/data"

type StudentClassRecord = NonNullable<
  Awaited<ReturnType<typeof getAdminStudentClassRecord>>
>
type Enrollment = StudentClassRecord["enrollment"]
type ClassSection = Enrollment["classSection"]

export default async function AdminStudentClassRecordPage({
  params,
}: {
  params: Promise<{ userId: string; classSectionId: string }>
}) {
  const { userId, classSectionId } = await params
  const record = await getAdminStudentClassRecord(userId, classSectionId)

  if (!record) {
    notFound()
  }

  const { user, enrollment } = record
  const section = enrollment.classSection
  const attendanceRows = getAttendanceRows(enrollment)
  const attendanceSummary = getAttendanceSummary(attendanceRows)

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <AdminPageHeader
          title={`${user.name} - ${section.course.title}`}
          description={`${section.name} class record for ${user.email ?? "student account"}.`}
        />
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={`/admin/users/${user.id}`}>Back to student</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/users">Back to users</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryItem label="Student" value={user.name} />
        <SummaryItem label="Email" value={user.email ?? "-"} />
        <SummaryItem label="Course" value={section.course.title} />
        <SummaryItem label="Class section" value={section.name} />
        <SummaryItem label="Term" value={section.term?.name ?? "-"} />
        <SummaryItem
          label="Campus"
          value={section.campus?.name ?? "Organization-wide"}
        />
        <SummaryItem label="Instructors" value={formatInstructors(section)} />
        <SummaryItem label="Enrollment" value={enrollment.status} />
      </div>

      <DetailsSection title="Attendance" defaultOpen>
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <SummaryItem
              label="Total sessions"
              value={attendanceSummary.total.toString()}
            />
            <SummaryItem label="Present" value={attendanceSummary.present.toString()} />
            <SummaryItem label="Late" value={attendanceSummary.late.toString()} />
            <SummaryItem label="Absent" value={attendanceSummary.absent.toString()} />
            <SummaryItem
              label="Attendance rate"
              value={`${attendanceSummary.rate.toFixed(1)}%`}
            />
          </div>
          <AttendanceTable rows={attendanceRows} />
        </div>
      </DetailsSection>

      <DetailsSection title="Lesson progress">
        <LessonProgressTable section={section} />
      </DetailsSection>

      <DetailsSection title="Assignments">
        <AssignmentsTable section={section} />
      </DetailsSection>

      <DetailsSection title="Quizzes / Exams">
        <div className="space-y-4">
          <QuizzesTable section={section} />
          <ExamsTable section={section} />
        </div>
      </DetailsSection>

      <DetailsSection title="Grades" defaultOpen>
        <GradesTable enrollment={enrollment} />
      </DetailsSection>
    </div>
  )
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border bg-background p-3">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-sm font-medium" title={value}>
        {value}
      </div>
    </div>
  )
}

function DetailsSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string
  children: ReactNode
  defaultOpen?: boolean
}) {
  return (
    <details
      className="rounded-lg border bg-background p-4 open:space-y-4"
      open={defaultOpen}
    >
      <summary className="cursor-pointer text-sm font-semibold">{title}</summary>
      <div className="pt-4">{children}</div>
    </details>
  )
}

function AttendanceTable({ rows }: { rows: ReturnType<typeof getAttendanceRows> }) {
  return (
    <DataTable
      empty="No attendance records yet."
      headers={["Session", "Date", "Status", "Note"]}
      minWidth="min-w-[760px]"
      rows={rows.map((row) => (
        <TableRow key={row.record.id}>
          <TableCell className="max-w-[260px] truncate">
            {row.session.title ?? row.session.classSession?.title ?? "Attendance"}
          </TableCell>
          <TableCell>{formatDateTime(row.session.takenAt)}</TableCell>
          <TableCell>
            <Badge variant="secondary">{row.record.status}</Badge>
          </TableCell>
          <TableCell className="max-w-[320px] truncate">
            {row.record.note ?? "-"}
          </TableCell>
        </TableRow>
      ))}
    />
  )
}

function LessonProgressTable({ section }: { section: ClassSection }) {
  return (
    <DataTable
      empty="No published lessons yet."
      headers={[
        "Lesson",
        "Type",
        "Provider",
        "Progress",
        "Watched",
        "Completed",
        "Completed at",
        "Last watched",
      ]}
      minWidth="min-w-[980px]"
      rows={section.lessons.map((lesson) => {
        const progress = lesson.videoProgress[0]
        const progressRate = progress ? Number(progress.progressRate) : 0
        const duration = progress?.durationSeconds ?? lesson.durationSeconds ?? 0

        return (
          <TableRow key={lesson.id}>
            <TableCell className="max-w-[260px] truncate font-medium">
              {lesson.title}
            </TableCell>
            <TableCell>{lesson.contentType}</TableCell>
            <TableCell>{lesson.videoProvider ?? "-"}</TableCell>
            <TableCell>{progressRate.toFixed(1)}%</TableCell>
            <TableCell>
              {progress?.watchedSeconds ?? 0} / {duration || "-"}
            </TableCell>
            <TableCell>
              <Badge variant={progress?.completed ? "default" : "secondary"}>
                {progress?.completed ? "Completed" : "Not completed"}
              </Badge>
            </TableCell>
            <TableCell>{formatDateTime(progress?.completedAt)}</TableCell>
            <TableCell>{formatDateTime(progress?.lastWatchedAt)}</TableCell>
          </TableRow>
        )
      })}
    />
  )
}

function AssignmentsTable({ section }: { section: ClassSection }) {
  return (
    <DataTable
      empty="No assignments yet."
      headers={[
        "Assignment",
        "Due",
        "Status",
        "Submitted",
        "Score",
        "Feedback",
        "Attachment",
      ]}
      minWidth="min-w-[1040px]"
      rows={section.assignments.map((assignment) => {
        const submission = assignment.submissions[0]
        const attachment = submission?.attachments[0]

        return (
          <TableRow key={assignment.id}>
            <TableCell className="max-w-[260px] truncate font-medium">
              {assignment.title}
            </TableCell>
            <TableCell>{formatDateTime(assignment.dueAt)}</TableCell>
            <TableCell>
              <Badge variant="secondary">
                {getAssignmentStatus(assignment.dueAt, submission)}
              </Badge>
            </TableCell>
            <TableCell>{formatDateTime(submission?.submittedAt)}</TableCell>
            <TableCell>
              {submission?.score
                ? `${formatDecimal(submission.score)} / ${
                    assignment.pointsPossible
                      ? formatDecimal(assignment.pointsPossible)
                      : "-"
                  }`
                : "-"}
            </TableCell>
            <TableCell className="max-w-[260px] truncate">
              {submission?.feedback ?? "-"}
            </TableCell>
            <TableCell className="max-w-[240px] truncate">
              {attachment ? (
                <Link
                  className="underline-offset-4 hover:underline"
                  href={`/api/files/${attachment.id}/download`}
                >
                  {attachment.originalName}
                </Link>
              ) : (
                "-"
              )}
            </TableCell>
          </TableRow>
        )
      })}
    />
  )
}

function QuizzesTable({ section }: { section: ClassSection }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">Quizzes</h3>
      <DataTable
        empty="No quizzes yet."
        headers={[
          "Quiz",
          "Status",
          "Started",
          "Submitted",
          "Score",
          "Max score",
          "Attempts",
        ]}
        minWidth="min-w-[940px]"
        rows={section.quizzes.map((quiz) => {
          const submittedAttempts = quiz.attempts.filter(
            (attempt) => attempt.submittedAt
          )
          const bestAttempt = getBestQuizAttempt(submittedAttempts)
          const latestAttempt = quiz.attempts[0]
          const possible = getQuizPointsPossible(quiz)

          return (
            <TableRow key={quiz.id}>
              <TableCell className="max-w-[260px] truncate font-medium">
                {quiz.title}
              </TableCell>
              <TableCell>
                <Badge variant="secondary">
                  {latestAttempt
                    ? latestAttempt.submittedAt
                      ? "Submitted"
                      : "In progress"
                    : "Not started"}
                </Badge>
              </TableCell>
              <TableCell>{formatDateTime(latestAttempt?.startedAt)}</TableCell>
              <TableCell>{formatDateTime(bestAttempt?.submittedAt)}</TableCell>
              <TableCell>
                {bestAttempt?.score ? formatDecimal(bestAttempt.score) : "-"}
              </TableCell>
              <TableCell>{possible}</TableCell>
              <TableCell>{quiz.attempts.length}</TableCell>
            </TableRow>
          )
        })}
      />
    </div>
  )
}

function ExamsTable({ section }: { section: ClassSection }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">Exams</h3>
      <DataTable
        empty="No exams yet."
        headers={["Exam", "Type", "Date", "Max score", "Location", "Score"]}
        minWidth="min-w-[900px]"
        rows={section.exams.map((exam) => (
          <TableRow key={exam.id}>
            <TableCell className="max-w-[260px] truncate font-medium">
              {exam.title}
            </TableCell>
            <TableCell>{exam.examType ?? "-"}</TableCell>
            <TableCell>{formatDateTime(exam.startsAt)}</TableCell>
            <TableCell>
              {exam.pointsPossible ? formatDecimal(exam.pointsPossible) : "-"}
            </TableCell>
            <TableCell className="max-w-[220px] truncate">
              {exam.location ?? "-"}
            </TableCell>
            <TableCell>-</TableCell>
          </TableRow>
        ))}
      />
    </div>
  )
}

function GradesTable({ enrollment }: { enrollment: Enrollment }) {
  return (
    <DataTable
      empty="No final grade has been calculated yet."
      headers={[
        "Course",
        "Class section",
        "Total score",
        "Letter",
        "Grade point",
        "Credit",
        "Earned credit",
        "Status",
      ]}
      minWidth="min-w-[980px]"
      rows={enrollment.classSection.finalGrades.map((grade) => (
        <TableRow key={grade.id}>
          <TableCell className="max-w-[220px] truncate">
            {enrollment.classSection.course.title}
          </TableCell>
          <TableCell className="max-w-[220px] truncate">
            {enrollment.classSection.name}
          </TableCell>
          <TableCell>
            {grade.percentage
              ? `${formatDecimal(grade.percentage)}%`
              : grade.numericScore
                ? formatDecimal(grade.numericScore)
                : "-"}
          </TableCell>
          <TableCell>{grade.letterGrade ?? "-"}</TableCell>
          <TableCell>
            {grade.gradePoint ? formatDecimal(grade.gradePoint) : "-"}
          </TableCell>
          <TableCell>
            {enrollment.classSection.course.credits
              ? formatDecimal(enrollment.classSection.course.credits)
              : "-"}
          </TableCell>
          <TableCell>
            {grade.creditsEarned ? formatDecimal(grade.creditsEarned) : "-"}
          </TableCell>
          <TableCell>
            <Badge variant="secondary">{grade.status}</Badge>
          </TableCell>
        </TableRow>
      ))}
    />
  )
}

function getAttendanceRows(enrollment: Enrollment) {
  return enrollment.classSection.attendanceSessions.flatMap((session) =>
    session.records.map((record) => ({
      session,
      record,
    }))
  )
}

function getAttendanceSummary(records: ReturnType<typeof getAttendanceRows>) {
  const counted = records.filter(
    (row) => row.record.status !== AttendanceStatus.PENDING
  )
  const present = counted.filter(
    (row) => row.record.status === AttendanceStatus.PRESENT
  ).length
  const late = counted.filter(
    (row) => row.record.status === AttendanceStatus.LATE
  ).length
  const absent = counted.filter((row) =>
    ([
      AttendanceStatus.ABSENT,
      AttendanceStatus.SICK_LEAVE,
      AttendanceStatus.OFFICIAL_ABSENCE,
    ] as AttendanceStatus[]).includes(row.record.status)
  ).length
  const rate = counted.length
    ? (counted.reduce((sum, row) => sum + attendanceCredit(row.record.status), 0) /
        counted.length) *
      100
    : 0

  return {
    total: counted.length,
    present,
    late,
    absent,
    rate,
  }
}

function attendanceCredit(status: AttendanceStatus) {
  if (status === AttendanceStatus.PRESENT) return 1
  if (status === AttendanceStatus.LATE) return 0.5
  if (
    status === AttendanceStatus.EXCUSED ||
    status === AttendanceStatus.SICK_LEAVE ||
    status === AttendanceStatus.OFFICIAL_ABSENCE
  ) {
    return 1
  }
  if (status === AttendanceStatus.EARLY_LEAVE) return 0.75
  return 0
}

function formatInstructors(section: ClassSection) {
  if (!section.instructors.length) return "Unassigned"

  return section.instructors
    .map((item) => item.instructor.name)
    .filter(Boolean)
    .join(", ")
}

function getAssignmentStatus(
  dueAt: Date | null,
  submission?: ClassSection["assignments"][number]["submissions"][number]
) {
  if (submission?.gradedAt) return "Graded"
  if (submission?.submittedAt && dueAt && submission.submittedAt > dueAt) {
    return "Late"
  }
  if (submission?.submittedAt) return "Submitted"
  if (dueAt && dueAt < new Date()) return "Missing"
  return "Not submitted"
}

function getQuizPointsPossible(quiz: ClassSection["quizzes"][number]) {
  if (quiz.pointsPossible) return formatDecimal(quiz.pointsPossible)

  const total = quiz.questions.reduce(
    (sum, question) => sum + Number(question.points),
    0
  )

  return total ? total.toFixed(1) : "-"
}

function getBestQuizAttempt(
  attempts: ClassSection["quizzes"][number]["attempts"]
) {
  return attempts.reduce<(typeof attempts)[number] | undefined>(
    (best, attempt) => {
      if (!best) return attempt
      return Number(attempt.score ?? 0) > Number(best.score ?? 0) ? attempt : best
    },
    undefined
  )
}

function formatDecimal(value: { toString(): string }) {
  const numberValue = Number(value)

  if (Number.isFinite(numberValue)) {
    return Number.isInteger(numberValue)
      ? numberValue.toString()
      : numberValue.toFixed(1)
  }

  return value.toString()
}
