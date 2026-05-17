import Link from "next/link"
import { notFound } from "next/navigation"
import type { ReactNode } from "react"
import { AttendanceStatus, FinalGradeStatus, UserRole } from "@prisma/client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getAdminUserDetail } from "@/modules/admin/data"
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
        <EnrolledClassesTable enrollments={user.enrollments} studentId={user.id} />
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
  studentId,
}: {
  enrollments: StudentEnrollment[]
  studentId: string
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
        "Actions",
      ]}
      minWidth="min-w-[1040px]"
      rows={enrollments.map((enrollment) => {
        const section = enrollment.classSection
        const recordHref = `/admin/users/${studentId}/classes/${section.id}`

        return (
          <TableRow key={enrollment.id}>
            <TableCell className="max-w-[220px] truncate font-medium">
              {section.course.title}
            </TableCell>
            <TableCell className="max-w-[220px] truncate">
              <Link
                className="font-medium underline-offset-4 hover:underline"
                href={recordHref}
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
            <TableCell>
              <Button asChild size="sm" variant="outline">
                <Link href={recordHref}>View class record</Link>
              </Button>
            </TableCell>
          </TableRow>
        )
      })}
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
