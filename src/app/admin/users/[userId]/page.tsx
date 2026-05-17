import Link from "next/link"
import { notFound } from "next/navigation"
import type { ReactNode } from "react"
import { AttendanceStatus, FinalGradeStatus, UserRole } from "@prisma/client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getAdminUserDetail, formatDateTime } from "@/modules/admin/data"
import {
  ActiveBadge,
  AdminPageHeader,
  DataTable,
  Field,
  FormCard,
  SubmitButton,
  TableCell,
  TableRow,
} from "@/modules/admin/components"
import {
  removeParentStudentRelation,
  saveParentStudentRelation,
} from "@/modules/admin/actions"
import { UserForm } from "@/modules/admin/user-form"

type AdminUserDetail = NonNullable<Awaited<ReturnType<typeof getAdminUserDetail>>>
type DetailUser = AdminUserDetail["user"]
type StudentEnrollment = DetailUser["enrollments"][number]

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>
}) {
  const { userId } = await params
  const detail = await getAdminUserDetail(userId)

  if (!detail) {
    notFound()
  }

  const { user } = detail
  const roles = user.roleAssignments.map((assignment) => assignment.role)
  const isParent = roles.includes(UserRole.PARENT)
  const isStudent = roles.includes(UserRole.STUDENT)
  const linkedStudentIds = new Set(
    user.parentRelations.map((relation) => relation.studentId)
  )
  const linkedParentIds = new Set(
    user.studentParentRelations.map((relation) => relation.parentId)
  )
  const studentOptions = detail.studentOptions.filter(
    (option) => option.id !== user.id && !linkedStudentIds.has(option.id)
  )
  const parentOptions = detail.parentOptions.filter(
    (option) => option.id !== user.id && !linkedParentIds.has(option.id)
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <AdminPageHeader
          title={user.name}
          description="Edit the user profile, role scope, student placement, family links, and student academic record."
        />
        <Button asChild variant="outline">
          <Link href="/admin/users">Back to users</Link>
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryItem label="Email" value={user.email ?? "-"} />
        <SummaryItem label="Organization" value={user.organization.name} />
        <SummaryItem
          label="Roles"
          value={roles.length ? roles.join(", ") : "-"}
        />
        <div className="rounded-lg border bg-background p-3">
          <div className="text-xs font-medium text-muted-foreground">Status</div>
          <div className="mt-2">
            <ActiveBadge active={user.isActive} />
          </div>
        </div>
      </div>

      {isStudent ? <StudentAcademicOverview user={user} /> : null}

      <DetailsSection title="Account details" defaultOpen={!isStudent}>
        <UserForm
          campusOptions={detail.campusOptions}
          gradeLevelOptions={detail.gradeLevelOptions}
          homeroomOptions={detail.homeroomOptions}
          organizationOptions={detail.organizationOptions}
          user={user}
        />
      </DetailsSection>

      {isParent ? (
        <DetailsSection title="Linked students" defaultOpen>
          <ParentLinks
            parentId={user.id}
            relations={user.parentRelations}
            studentOptions={studentOptions}
          />
        </DetailsSection>
      ) : null}

      {isStudent ? (
        <DetailsSection title="Linked parents" defaultOpen>
          <StudentLinks
            parentOptions={parentOptions}
            relations={user.studentParentRelations}
            studentId={user.id}
          />
        </DetailsSection>
      ) : null}
    </div>
  )
}

function StudentAcademicOverview({ user }: { user: DetailUser }) {
  const summary = getStudentAcademicSummary(user.enrollments)

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Student academic overview</h2>
        <p className="text-sm text-muted-foreground">
          Read-only academic activity for this student across enrolled classes.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <SummaryItem
          label="Enrolled classes"
          value={summary.enrolledClasses.toString()}
        />
        <SummaryItem
          label="Attendance rate"
          value={`${summary.attendanceRate.toFixed(1)}%`}
        />
        <SummaryItem
          label="Lesson completion"
          value={`${summary.lessonCompletionRate.toFixed(1)}%`}
        />
        <SummaryItem
          label="Assignments submitted"
          value={`${summary.submittedAssignments}/${summary.assignmentCount}`}
        />
        <SummaryItem
          label="Quiz attempts"
          value={summary.quizAttempts.toString()}
        />
        <SummaryItem
          label="Published grades"
          value={summary.publishedGrades.toString()}
        />
      </div>

      <DetailsSection title="Student placement" defaultOpen>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SummaryItem
            label="Campus"
            value={user.studentProfile?.campus?.name ?? "-"}
          />
          <SummaryItem
            label="Grade level"
            value={user.studentProfile?.currentGradeLevel?.name ?? "-"}
          />
          <SummaryItem
            label="Homeroom"
            value={user.studentProfile?.homeroom?.name ?? "-"}
          />
          <SummaryItem
            label="Student number"
            value={user.studentProfile?.studentNumber ?? "-"}
          />
        </div>
      </DetailsSection>

      <DetailsSection title="Enrolled classes" defaultOpen>
        <EnrolledClassesTable enrollments={user.enrollments} />
      </DetailsSection>

      <DetailsSection title="Attendance">
        <AttendanceOverview enrollments={user.enrollments} />
      </DetailsSection>

      <DetailsSection title="Lesson progress">
        <LessonProgressTable enrollments={user.enrollments} />
      </DetailsSection>

      <DetailsSection title="Assignments">
        <AssignmentsTable enrollments={user.enrollments} />
      </DetailsSection>

      <DetailsSection title="Quizzes / Exams">
        <QuizzesTable enrollments={user.enrollments} />
        <div className="mt-4">
          <ExamsTable enrollments={user.enrollments} />
        </div>
      </DetailsSection>

      <DetailsSection title="Grades" defaultOpen>
        <GradesTable enrollments={user.enrollments} />
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

function EnrolledClassesTable({
  enrollments,
}: {
  enrollments: StudentEnrollment[]
}) {
  return (
    <DataTable
      empty="No enrolled classes yet."
      headers={[
        "Course",
        "Class section",
        "Term",
        "Campus",
        "Instructors",
        "Status",
      ]}
      minWidth="min-w-[940px]"
      rows={enrollments.map((enrollment) => {
        const section = enrollment.classSection

        return (
          <TableRow key={enrollment.id}>
            <TableCell className="max-w-[220px] truncate font-medium">
              {section.course.title}
            </TableCell>
            <TableCell className="max-w-[220px] truncate">
              <Link
                className="font-medium underline-offset-4 hover:underline"
                href={`/admin/class-sections/${section.id}`}
              >
                {section.name}
              </Link>
            </TableCell>
            <TableCell>{section.term?.name ?? "-"}</TableCell>
            <TableCell>{section.campus?.name ?? "Organization-wide"}</TableCell>
            <TableCell className="max-w-[240px] truncate">
              {formatInstructors(section.instructors)}
            </TableCell>
            <TableCell>
              <Badge variant="secondary">{enrollment.status}</Badge>
            </TableCell>
          </TableRow>
        )
      })}
    />
  )
}

function AttendanceOverview({
  enrollments,
}: {
  enrollments: StudentEnrollment[]
}) {
  const records = getAttendanceRows(enrollments)
  const summary = getAttendanceSummary(records)

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <SummaryItem label="Total sessions" value={summary.total.toString()} />
        <SummaryItem label="Present" value={summary.present.toString()} />
        <SummaryItem label="Late" value={summary.late.toString()} />
        <SummaryItem label="Absent" value={summary.absent.toString()} />
        <SummaryItem
          label="Attendance rate"
          value={`${summary.rate.toFixed(1)}%`}
        />
      </div>
      <DataTable
        empty="No attendance records yet."
        headers={["Class", "Session", "Date", "Status", "Note", "Updated"]}
        minWidth="min-w-[980px]"
        rows={records.slice(0, 20).map((row) => (
          <TableRow key={row.record.id}>
            <TableCell className="max-w-[220px] truncate">
              {row.section.course.title} / {row.section.name}
            </TableCell>
            <TableCell className="max-w-[220px] truncate">
              {row.session.title ?? row.classSession?.title ?? "Attendance"}
            </TableCell>
            <TableCell>{formatDateTime(row.session.takenAt)}</TableCell>
            <TableCell>
              <Badge variant="secondary">{row.record.status}</Badge>
            </TableCell>
            <TableCell className="max-w-[240px] truncate">
              {row.record.note ?? "-"}
            </TableCell>
            <TableCell>{formatDateTime(row.record.updatedAt)}</TableCell>
          </TableRow>
        ))}
      />
    </div>
  )
}

function LessonProgressTable({
  enrollments,
}: {
  enrollments: StudentEnrollment[]
}) {
  const rows = enrollments.flatMap((enrollment) =>
    enrollment.classSection.lessons.map((lesson) => ({
      enrollment,
      lesson,
      progress: lesson.videoProgress[0],
    }))
  )

  return (
    <DataTable
      empty="No published lessons yet."
      headers={[
        "Class",
        "Lesson",
        "Type",
        "Status",
        "Progress",
        "Watched",
        "Last watched",
      ]}
      minWidth="min-w-[980px]"
      rows={rows.slice(0, 20).map(({ enrollment, lesson, progress }) => {
        const progressRate = progress ? Number(progress.progressRate) : 0
        const duration = progress?.durationSeconds ?? lesson.durationSeconds ?? 0

        return (
          <TableRow key={lesson.id}>
            <TableCell className="max-w-[220px] truncate">
              {enrollment.classSection.course.title} /{" "}
              {enrollment.classSection.name}
            </TableCell>
            <TableCell className="max-w-[260px] truncate font-medium">
              {lesson.title}
            </TableCell>
            <TableCell>{lesson.contentType}</TableCell>
            <TableCell>
              <Badge variant={progress?.completed ? "default" : "secondary"}>
                {progress?.completed
                  ? "Completed"
                  : progress
                    ? "In progress"
                    : "Not started"}
              </Badge>
            </TableCell>
            <TableCell>{progressRate.toFixed(1)}%</TableCell>
            <TableCell>
              {progress?.watchedSeconds ?? 0} / {duration || "-"}
            </TableCell>
            <TableCell>{formatDateTime(progress?.lastWatchedAt)}</TableCell>
          </TableRow>
        )
      })}
    />
  )
}

function AssignmentsTable({
  enrollments,
}: {
  enrollments: StudentEnrollment[]
}) {
  const rows = enrollments.flatMap((enrollment) =>
    enrollment.classSection.assignments.map((assignment) => ({
      enrollment,
      assignment,
      submission: assignment.submissions[0],
    }))
  )

  return (
    <DataTable
      empty="No assignments yet."
      headers={[
        "Class",
        "Assignment",
        "Due",
        "Status",
        "Submitted",
        "Score",
        "Feedback",
      ]}
      minWidth="min-w-[1040px]"
      rows={rows.slice(0, 20).map(({ enrollment, assignment, submission }) => (
        <TableRow key={assignment.id}>
          <TableCell className="max-w-[220px] truncate">
            {enrollment.classSection.course.title} / {enrollment.classSection.name}
          </TableCell>
          <TableCell className="max-w-[240px] truncate font-medium">
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
        </TableRow>
      ))}
    />
  )
}

function QuizzesTable({ enrollments }: { enrollments: StudentEnrollment[] }) {
  const rows = enrollments.flatMap((enrollment) =>
    enrollment.classSection.quizzes.map((quiz) => ({
      enrollment,
      quiz,
      attempts: quiz.attempts,
    }))
  )

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">Quizzes</h3>
      <DataTable
        empty="No quizzes yet."
        headers={["Class", "Quiz", "Status", "Attempts", "Best/latest score", "Submitted"]}
        minWidth="min-w-[940px]"
        rows={rows.slice(0, 20).map(({ enrollment, quiz, attempts }) => {
          const submittedAttempts = attempts.filter((attempt) => attempt.submittedAt)
          const bestAttempt = getBestQuizAttempt(submittedAttempts)
          const latestAttempt = attempts[0]
          const possible = getQuizPointsPossible(quiz)

          return (
            <TableRow key={quiz.id}>
              <TableCell className="max-w-[220px] truncate">
                {enrollment.classSection.course.title} /{" "}
                {enrollment.classSection.name}
              </TableCell>
              <TableCell className="max-w-[240px] truncate font-medium">
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
              <TableCell>{attempts.length}</TableCell>
              <TableCell>
                {bestAttempt?.score
                  ? `${formatDecimal(bestAttempt.score)} / ${possible}`
                  : "-"}
              </TableCell>
              <TableCell>{formatDateTime(bestAttempt?.submittedAt)}</TableCell>
            </TableRow>
          )
        })}
      />
    </div>
  )
}

function ExamsTable({ enrollments }: { enrollments: StudentEnrollment[] }) {
  const rows = enrollments.flatMap((enrollment) =>
    enrollment.classSection.exams.map((exam) => ({ enrollment, exam }))
  )

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">Exams</h3>
      <DataTable
        empty="No exams yet."
        headers={["Class", "Exam", "Type", "Date", "Max score", "Location"]}
        minWidth="min-w-[900px]"
        rows={rows.slice(0, 20).map(({ enrollment, exam }) => (
          <TableRow key={exam.id}>
            <TableCell className="max-w-[220px] truncate">
              {enrollment.classSection.course.title} / {enrollment.classSection.name}
            </TableCell>
            <TableCell className="max-w-[240px] truncate font-medium">
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
          </TableRow>
        ))}
      />
    </div>
  )
}

function GradesTable({ enrollments }: { enrollments: StudentEnrollment[] }) {
  const rows = enrollments.flatMap((enrollment) =>
    enrollment.classSection.finalGrades.map((grade) => ({ enrollment, grade }))
  )

  return (
    <DataTable
      empty="No final grades yet."
      headers={[
        "Class",
        "Course",
        "Total score",
        "Letter",
        "Grade point",
        "Credit",
        "Earned credit",
        "Status",
      ]}
      minWidth="min-w-[980px]"
      rows={rows.map(({ enrollment, grade }) => (
        <TableRow key={grade.id}>
          <TableCell className="max-w-[220px] truncate">
            {enrollment.classSection.name}
          </TableCell>
          <TableCell className="max-w-[220px] truncate">
            {enrollment.classSection.course.title}
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

function ParentLinks({
  parentId,
  relations,
  studentOptions,
}: {
  parentId: string
  relations: Array<{
    id: string
    studentId: string
    relation: string
    isPrimary: boolean
    student: {
      name: string
      email: string | null
      studentProfile: {
        currentGradeLevel: { name: string } | null
        homeroom: { name: string } | null
      } | null
    }
  }>
  studentOptions: { id: string; label: string }[]
}) {
  return (
    <FormCard title="Linked students">
      <div className="space-y-4">
        <form
          action={saveParentStudentRelation}
          className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"
        >
          <input name="parentId" type="hidden" value={parentId} />
          <label className="grid min-w-0 gap-1 text-sm md:col-span-2">
            <span className="font-medium">Student</span>
            <select
              className="h-8 min-w-0 rounded-lg border border-input bg-background px-2 text-sm"
              name="studentId"
              required
            >
              <option value="">
                {studentOptions.length ? "Select student" : "No available students"}
              </option>
              {studentOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <Field label="Relation" name="relation" defaultValue="Guardian" />
          <label className="flex items-end gap-2 text-sm">
            <input name="isPrimary" type="checkbox" />
            Primary
          </label>
          <div className="flex items-end">
            <SubmitButton label="Link student" />
          </div>
        </form>

        <DataTable
          empty="No students are linked to this parent yet."
          headers={["Student", "Email", "Placement", "Relation", "Primary", "Actions"]}
          minWidth="min-w-[760px]"
          rows={relations.map((relation) => (
            <TableRow key={relation.id}>
              <TableCell className="font-medium">{relation.student.name}</TableCell>
              <TableCell>{relation.student.email ?? "-"}</TableCell>
              <TableCell>
                {[
                  relation.student.studentProfile?.currentGradeLevel?.name,
                  relation.student.studentProfile?.homeroom?.name,
                ]
                  .filter(Boolean)
                  .join(" / ") || "-"}
              </TableCell>
              <TableCell>{relation.relation}</TableCell>
              <TableCell>{relation.isPrimary ? "Yes" : "No"}</TableCell>
              <TableCell>
                <form action={removeParentStudentRelation}>
                  <input name="relationId" type="hidden" value={relation.id} />
                  <Button size="sm" type="submit" variant="destructive">
                    Remove
                  </Button>
                </form>
              </TableCell>
            </TableRow>
          ))}
        />
      </div>
    </FormCard>
  )
}

function StudentLinks({
  studentId,
  relations,
  parentOptions,
}: {
  studentId: string
  relations: Array<{
    id: string
    parentId: string
    relation: string
    isPrimary: boolean
    parent: {
      name: string
      email: string | null
    }
  }>
  parentOptions: { id: string; label: string }[]
}) {
  return (
    <FormCard title="Linked parents">
      <div className="space-y-4">
        <form
          action={saveParentStudentRelation}
          className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"
        >
          <input name="studentId" type="hidden" value={studentId} />
          <label className="grid min-w-0 gap-1 text-sm md:col-span-2">
            <span className="font-medium">Parent</span>
            <select
              className="h-8 min-w-0 rounded-lg border border-input bg-background px-2 text-sm"
              name="parentId"
              required
            >
              <option value="">
                {parentOptions.length ? "Select parent" : "No available parents"}
              </option>
              {parentOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <Field label="Relation" name="relation" defaultValue="Guardian" />
          <label className="flex items-end gap-2 text-sm">
            <input name="isPrimary" type="checkbox" />
            Primary
          </label>
          <div className="flex items-end">
            <SubmitButton label="Link parent" />
          </div>
        </form>

        <DataTable
          empty="No parents are linked to this student yet."
          headers={["Parent", "Email", "Relation", "Primary", "Actions"]}
          minWidth="min-w-[680px]"
          rows={relations.map((relation) => (
            <TableRow key={relation.id}>
              <TableCell className="font-medium">{relation.parent.name}</TableCell>
              <TableCell>{relation.parent.email ?? "-"}</TableCell>
              <TableCell>{relation.relation}</TableCell>
              <TableCell>{relation.isPrimary ? "Yes" : "No"}</TableCell>
              <TableCell>
                <form action={removeParentStudentRelation}>
                  <input name="relationId" type="hidden" value={relation.id} />
                  <Button size="sm" type="submit" variant="destructive">
                    Remove
                  </Button>
                </form>
              </TableCell>
            </TableRow>
          ))}
        />
      </div>
    </FormCard>
  )
}

function getStudentAcademicSummary(enrollments: StudentEnrollment[]) {
  const attendanceRows = getAttendanceRows(enrollments)
  const attendanceSummary = getAttendanceSummary(attendanceRows)
  const lessons = enrollments.flatMap(
    (enrollment) => enrollment.classSection.lessons
  )
  const completedLessons = lessons.filter(
    (lesson) => lesson.videoProgress[0]?.completed
  ).length
  const assignments = enrollments.flatMap(
    (enrollment) => enrollment.classSection.assignments
  )
  const submittedAssignments = assignments.filter(
    (assignment) => assignment.submissions[0]?.submittedAt
  ).length
  const quizAttempts = enrollments.reduce(
    (count, enrollment) =>
      count +
      enrollment.classSection.quizzes.reduce(
        (quizCount, quiz) => quizCount + quiz.attempts.length,
        0
      ),
    0
  )
  const publishedGrades = enrollments.reduce(
    (count, enrollment) =>
      count +
      enrollment.classSection.finalGrades.filter((grade) =>
        ([FinalGradeStatus.PUBLISHED, FinalGradeStatus.FINALIZED] as FinalGradeStatus[]).includes(
          grade.status
        )
      ).length,
    0
  )

  return {
    enrolledClasses: enrollments.length,
    attendanceRate: attendanceSummary.rate,
    lessonCompletionRate: lessons.length
      ? (completedLessons / lessons.length) * 100
      : 0,
    assignmentCount: assignments.length,
    submittedAssignments,
    quizAttempts,
    publishedGrades,
  }
}

function getAttendanceRows(enrollments: StudentEnrollment[]) {
  return enrollments.flatMap((enrollment) =>
    enrollment.classSection.attendanceSessions.flatMap((session) =>
      session.records.map((record) => ({
        enrollment,
        section: enrollment.classSection,
        session,
        classSession: session.classSession,
        record,
      }))
    )
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

function formatInstructors(
  instructors: StudentEnrollment["classSection"]["instructors"]
) {
  if (!instructors.length) return "Unassigned"

  return instructors
    .map((item) => item.instructor.name)
    .filter(Boolean)
    .join(", ")
}

function getAssignmentStatus(
  dueAt: Date | null,
  submission?: StudentEnrollment["classSection"]["assignments"][number]["submissions"][number]
) {
  if (submission?.gradedAt) return "Graded"
  if (submission?.submittedAt && dueAt && submission.submittedAt > dueAt) {
    return "Late"
  }
  if (submission?.submittedAt) return "Submitted"
  if (dueAt && dueAt < new Date()) return "Missing"
  return "Not submitted"
}

function getQuizPointsPossible(
  quiz: StudentEnrollment["classSection"]["quizzes"][number]
) {
  if (quiz.pointsPossible) return formatDecimal(quiz.pointsPossible)

  const total = quiz.questions.reduce(
    (sum, question) => sum + Number(question.points),
    0
  )

  return total ? total.toFixed(1) : "-"
}

function getBestQuizAttempt(
  attempts: StudentEnrollment["classSection"]["quizzes"][number]["attempts"]
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
