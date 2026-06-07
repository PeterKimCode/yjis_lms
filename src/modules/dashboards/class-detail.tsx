import { notFound } from "next/navigation"
import Link from "next/link"
import type { ReactNode } from "react"
import { CheckCircle2 } from "lucide-react"
import { AttendanceStatus, DeliveryMode } from "@prisma/client"

import { Button } from "@/components/ui/button"
import { FormDialog } from "@/components/form-dialog"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  DashboardPage,
  EmptyState,
  MetricCard,
  OpenButton,
  SectionBlock,
  SimpleTable,
  StatusBadge,
  TableCell,
  TableRow,
} from "@/modules/dashboards/components"
import {
  formatDateTime,
  getClassSectionDetail,
  getLessonFileOptionsForClassSection,
  getVideoFileOptionsForClassSection,
} from "@/modules/dashboards/data"
import {
  AssignmentPanel,
  type AssignmentPanelValue,
} from "@/modules/assignments/assignment-panel"
import {
  ExamPanel,
  QuizPanel,
  type ExamPanelValue,
  type QuizPanelValue,
} from "@/modules/quizzes/quiz-panel"
import { LessonForm, type LessonFormValue } from "@/modules/learning/lesson-form"
import {
  createAttendanceSession,
  createClassSession,
  saveAttendanceRecords,
} from "@/modules/attendance/actions"
import { createClassBoard } from "@/modules/boards/actions"
import { openClassConversation } from "@/modules/messages/actions"
import {
  BOARD_KIND_OPTIONS,
  boardKindHelp,
  boardKindLabel,
  getBoardSettings,
} from "@/modules/boards/constants"
import { getAttendanceSummary } from "@/modules/attendance/summary"
import {
  GradebookPanel,
  type ModuleGradeWeights,
  type GradebookPanelValue,
} from "@/modules/grades/gradebook-panel"
import { resolvePolicies } from "@/modules/policies/resolve"

type ClassSectionDetailMode = "instructor" | "student"

export async function ClassSectionDetail({
  userId,
  classSectionId,
  mode = "student",
  selectedLessonId,
}: {
  userId: string
  classSectionId: string
  mode?: ClassSectionDetailMode
  selectedLessonId?: string
}) {
  const section = await getClassSectionDetail(userId, classSectionId, {
    publishedLessonsOnly: mode === "student",
  })

  if (!section) {
    notFound()
  }

  const enrollmentCount = section.enrollments.length
  const policies = await resolvePolicies({
    organizationId: section.organizationId,
    campusId: section.campusId,
    classSectionId: section.id,
  })
  const visibleAttendanceRecords =
    mode === "student"
      ? section.attendanceSessions.flatMap((session) =>
          session.records.filter((record) => record.studentId === userId)
        )
      : section.attendanceSessions.flatMap((session) => session.records)
  const attendanceSummary = getAttendanceSummary(
    visibleAttendanceRecords,
    policies.attendance
  )
  const selectedLesson =
    mode === "instructor" && selectedLessonId
      ? section.lessons.find((lesson) => lesson.id === selectedLessonId)
      : null
  const videoFileOptions =
    mode === "instructor"
      ? await getVideoFileOptionsForClassSection({
          classSectionId: section.id,
          organizationId: section.organizationId,
          campusId: section.campusId,
        })
      : []
  const lessonFileOptions =
    mode === "instructor"
      ? await getLessonFileOptionsForClassSection({
          classSectionId: section.id,
          organizationId: section.organizationId,
          campusId: section.campusId,
        })
      : []
  const gradeWeights = getModuleWeights(section.gradingConfig)
  const instructorNames = formatInstructorNames(section.instructors)

  return (
    <DashboardPage
      title={section.name}
      description={`${section.course.title} - ${
        section.campus?.name ?? "Organization-wide"
      } - ${section.term?.name ?? "No term"}${
        instructorNames ? ` · Instructor: ${instructorNames}` : ""
      }`}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Students" value={section._count.enrollments} />
        <MetricCard label="Lessons" value={section.lessons.length} />
        <MetricCard label="Assignments" value={section.assignments.length} />
        <MetricCard label="Quizzes" value={section.quizzes.length} />
      </div>

      <div className="flex flex-wrap gap-2 rounded-lg border bg-background p-3">
        <Button asChild size="sm" variant="outline">
          <Link href="/messages">Messages</Link>
        </Button>
        {mode === "instructor" ? (
          <form action={openClassConversation}>
            <input name="classSectionId" type="hidden" value={section.id} />
            <Button size="sm" type="submit" variant="outline">
              Open class conversation
            </Button>
          </form>
        ) : (
          <Button asChild size="sm" variant="outline">
            <Link href="/messages">Message teacher</Link>
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-6">
        <SectionBlock
          description="Create, publish, and review lesson completion."
          id="lessons"
          meta={<SectionBadge>{section.lessons.length} lessons</SectionBadge>}
          title={`Lessons · ${gradeWeights.lessonsWeight}%`}
        >
          <div className="space-y-4">
            {mode === "instructor" ? (
              <FormDialog
                title="Create lesson"
                description="Add a text, video, or file lesson. Lesson order is assigned automatically."
                trigger="Create lesson"
              >
                <LessonForm
                  classSectionId={section.id}
                  fileAssetOptions={lessonFileOptions}
                  videoFileOptions={videoFileOptions}
                />
              </FormDialog>
            ) : null}
            <SimpleTable
              empty={
                mode === "instructor"
                  ? "No lessons yet."
                  : "No published lessons yet."
              }
              headers={
                mode === "instructor"
                  ? [
                      "Order",
                      "Title",
                      "Type",
                      "Video",
                      "Published",
                      "Completion",
                      "Preview",
                      "Edit",
                    ]
                  : ["Order", "Title", "Type", "Progress", "Open"]
              }
              rows={section.lessons.map((lesson) => {
                const completedCount = lesson.videoProgress.filter(
                  (progress) => progress.completed
                ).length

                return (
                  <TableRow key={lesson.id}>
                    <TableCell>{lesson.sequence}</TableCell>
                    <TableCell className="font-medium">{lesson.title}</TableCell>
                    <TableCell>{lesson.contentType}</TableCell>
                    {mode === "instructor" ? (
                      <>
                        <TableCell className="max-w-[180px] truncate">
                          {lesson.contentType === "VIDEO"
                            ? lesson.videoProvider
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <StatusBadge
                            label={lesson.isPublished ? "Published" : "Draft"}
                            value={lesson.isPublished ? "PUBLISHED" : "DRAFT"}
                          />
                        </TableCell>
                        <TableCell>
                          <Link
                            className="text-primary underline-offset-4 hover:underline"
                            href={`/instructor/classes/${section.id}?lessonId=${lesson.id}#lesson-progress`}
                          >
                            {completedCount}/{enrollmentCount}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <LessonPreviewLink lesson={lesson} />
                        </TableCell>
                        <TableCell>
                          <FormDialog
                            title={`Edit lesson: ${lesson.title}`}
                            description="Update lesson content, publication, and attached video or file."
                            trigger="Edit"
                            variant="outline"
                          >
                            <LessonForm
                              classSectionId={section.id}
                              fileAssetOptions={lessonFileOptions}
                              lesson={toLessonFormValue(lesson)}
                              videoFileOptions={videoFileOptions}
                            />
                          </FormDialog>
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell>
                          <LessonProgressBadge
                            progress={lesson.videoProgress.find(
                              (progress) => progress.studentId === userId
                            )}
                          />
                        </TableCell>
                        <TableCell>
                          <OpenButton
                            href={`/student/classes/${section.id}/lessons/${lesson.id}`}
                          />
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                )
              })}
            />
            {mode === "instructor" && selectedLesson ? (
              <div className="space-y-3" id="lesson-progress">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-medium">
                      Completion detail: {selectedLesson.title}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      All enrolled students are shown, including students who
                      have not started.
                    </p>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/instructor/classes/${section.id}`}>
                      Close
                    </Link>
                  </Button>
                </div>
                <SimpleTable
                  empty="No students are enrolled in this class section."
                  headers={[
                    "Student",
                    "Email",
                    "Status",
                    "Watched",
                    "Duration",
                    "Progress",
                    "Last position",
                    "Last watched",
                    "Completed at",
                  ]}
                  rows={getLessonProgressRows(section, selectedLesson.id).map(
                    (item) => (
                      <TableRow key={item.studentId}>
                        <TableCell className="font-medium">
                          {item.name}
                        </TableCell>
                        <TableCell>{item.email}</TableCell>
                        <TableCell>{item.status}</TableCell>
                        <TableCell>{item.watchedSeconds}s</TableCell>
                        <TableCell>{item.durationSeconds}s</TableCell>
                        <TableCell>{item.progressRate.toFixed(1)}%</TableCell>
                        <TableCell>{item.lastPositionSeconds}s</TableCell>
                        <TableCell>{formatDateTime(item.lastWatchedAt)}</TableCell>
                        <TableCell>{formatDateTime(item.completedAt)}</TableCell>
                      </TableRow>
                    )
                  )}
                />
              </div>
            ) : null}
          </div>
        </SectionBlock>

        <SectionBlock
          description="Scheduled class meetings and attendance setup."
          id="sessions"
          meta={<SectionBadge>{section.sessions.length} sessions</SectionBadge>}
          title="Sessions"
        >
          {mode === "instructor" ? (
            <div className="mb-4">
              <FormDialog
                title="Create session"
                description="Schedule a class meeting. Attendance can be created from the session list after saving."
                trigger="Create session"
              >
              <form
                action={createClassSession}
                className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"
              >
                <input name="classSectionId" type="hidden" value={section.id} />
                <label className="grid gap-1 text-sm">
                  <span className="font-medium">Title</span>
                  <Input name="title" placeholder="Class meeting" />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium">Starts at</span>
                  <Input name="startsAt" required type="datetime-local" />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium">Ends at</span>
                  <Input name="endsAt" type="datetime-local" />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium">Location</span>
                  <Input name="location" placeholder="Room 101 or online" />
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium">Delivery mode</span>
                  <select
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                    name="deliveryMode"
                    defaultValue={DeliveryMode.OFFLINE}
                  >
                    {Object.values(DeliveryMode).map((modeValue) => (
                      <option key={modeValue} value={modeValue}>
                        {modeValue}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1 text-sm">
                  <span className="font-medium">Meeting URL</span>
                  <Input name="meetingUrl" placeholder="Optional online link" />
                </label>
                <div className="flex items-end">
                  <Button size="sm" type="submit">
                    Create session
                  </Button>
                </div>
              </form>
              </FormDialog>
            </div>
          ) : null}
          <SimpleTable
            empty="No class sessions yet."
            headers={
              mode === "instructor"
                ? ["Title", "Starts", "Ends", "Mode", "Location", "Attendance"]
                : ["Title", "Starts", "Mode", "Location"]
            }
            rows={section.sessions.map((session) => (
              <TableRow key={session.id}>
                <TableCell className="font-medium">
                  {session.title ?? "Class session"}
                </TableCell>
                <TableCell>{formatDateTime(session.startsAt)}</TableCell>
                {mode === "instructor" ? (
                  <TableCell>{formatDateTime(session.endsAt)}</TableCell>
                ) : null}
                <TableCell>{session.deliveryMode}</TableCell>
                <TableCell>{session.location ?? "-"}</TableCell>
                {mode === "instructor" ? (
                  <TableCell>
                    {session.attendanceSession ? (
                      "Created"
                    ) : (
                      <form action={createAttendanceSession}>
                        <input
                          name="classSectionId"
                          type="hidden"
                          value={section.id}
                        />
                        <input
                          name="classSessionId"
                          type="hidden"
                          value={session.id}
                        />
                        <input
                          name="title"
                          type="hidden"
                          value={session.title ?? "Attendance"}
                        />
                        <Button size="sm" type="submit" variant="outline">
                          Take attendance
                        </Button>
                      </form>
                    )}
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          />
        </SectionBlock>

        <SectionBlock
          description="Attendance summaries use the active school attendance policy."
          id="attendance"
          meta={
            <SectionBadge>
              {attendanceSummary.attendanceRate.toFixed(1)}% rate
            </SectionBadge>
          }
          title={`Attendance · ${gradeWeights.attendanceWeight}%`}
        >
          <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
              <AttendanceStat
                label="Total sessions"
                value={attendanceSummary.totalSessions}
              />
              <AttendanceStat
                label="Present"
                value={attendanceSummary.presentCount}
              />
              <AttendanceStat label="Late" value={attendanceSummary.lateCount} />
              <AttendanceStat
                label="Absent"
                value={attendanceSummary.absentCount}
              />
              <AttendanceStat
                label="Attendance rate"
                value={`${attendanceSummary.attendanceRate.toFixed(1)}%`}
              />
            </div>
            {mode === "instructor" ? (
              <p className="text-xs text-muted-foreground">
                Policy: late after{" "}
                {policies.attendance.lateThresholdMinutes ?? "not set"} minutes,
                late counts as absence:{" "}
                {policies.attendance.countLateAsAbsence ? "yes" : "no"}, override:{" "}
                {policies.attendance.allowInstructorOverride ? "allowed" : "blocked"},
                absence fail threshold:{" "}
                {policies.attendance.absenceFailThresholdRate
                  ? `${policies.attendance.absenceFailThresholdRate}%`
                  : "not set"}.
              </p>
            ) : null}
            {mode === "instructor" ? (
              section.attendanceSessions.length ? (
                <details className="rounded-md border bg-background p-3">
                  <summary className="cursor-pointer text-sm font-medium">
                    Manage attendance
                  </summary>
                  <div className="space-y-3 pt-3">
                    {section.attendanceSessions.map((attendance) => (
                      <details
                        className="rounded-md border bg-background p-3"
                        key={attendance.id}
                      >
                        <summary className="cursor-pointer text-sm font-medium">
                          {attendance.title ?? "Attendance"} -{" "}
                          {formatDateTime(attendance.takenAt)}
                        </summary>
                        <div className="pt-3">
                          <form action={saveAttendanceRecords} className="space-y-3">
                            <input
                              name="attendanceSessionId"
                              type="hidden"
                              value={attendance.id}
                            />
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-xs text-muted-foreground">
                                Default is Present. Change only students who are
                                late, absent, excused, or pending.
                              </p>
                              <Button size="sm" type="submit">
                                Save all
                              </Button>
                            </div>
                            <SimpleTable
                              empty="No attendance records were created."
                              headers={["Student", "Email", "Status", "Note", "Save"]}
                              rows={attendance.records.map((record, index) => (
                              <TableRow key={record.id}>
                                <TableCell className="font-medium">
                                  <input
                                    name="studentId"
                                    type="hidden"
                                    value={record.studentId}
                                  />
                                  {record.student.name}
                                </TableCell>
                                <TableCell>{record.student.email ?? "-"}</TableCell>
                                <TableCell>
                                    <select
                                      className="h-8 rounded-md border bg-background px-2 text-sm"
                                      name="status"
                                      defaultValue={
                                        record.status === AttendanceStatus.PENDING
                                          ? AttendanceStatus.PRESENT
                                          : record.status
                                      }
                                    >
                                      {Object.values(AttendanceStatus).map(
                                        (status) => (
                                          <option key={status} value={status}>
                                            {status}
                                          </option>
                                        )
                                      )}
                                    </select>
                                </TableCell>
                                <TableCell>
                                  <Input
                                    name="note"
                                    defaultValue={record.note ?? ""}
                                    placeholder="Optional"
                                  />
                                </TableCell>
                                <TableCell>
                                  <Button
                                    name="recordIndex"
                                    size="sm"
                                    type="submit"
                                    value={index}
                                    variant="outline"
                                  >
                                    Save
                                  </Button>
                                </TableCell>
                              </TableRow>
                              ))}
                            />
                          </form>
                        </div>
                      </details>
                    ))}
                  </div>
                </details>
              ) : (
                <EmptyState>
                  Create a class session, then click Take attendance.
                </EmptyState>
              )
            ) : (
              <SimpleTable
                empty="No attendance records yet."
                headers={["Session", "Date", "Status", "Note"]}
                rows={section.attendanceSessions.flatMap((attendance) =>
                  attendance.records
                    .filter((record) => record.studentId === userId)
                    .map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">
                          {attendance.title ??
                            attendance.classSession?.title ??
                            "Attendance"}
                        </TableCell>
                        <TableCell>{formatDateTime(attendance.takenAt)}</TableCell>
                        <TableCell>
                          <StatusBadge value={record.status} />
                        </TableCell>
                        <TableCell>{record.note ?? "-"}</TableCell>
                      </TableRow>
                    ))
                )}
              />
            )}
          </div>
        </SectionBlock>

        <SectionBlock
          description="Manage assignments, student submissions, and grading feedback."
          id="assignments"
          meta={<SectionBadge>{section.assignments.length} assignments</SectionBadge>}
          title={`Assignments · ${gradeWeights.assignmentsWeight}%`}
        >
          <AssignmentPanel
            assignments={section.assignments.map(toAssignmentPanelValue)}
            classSectionId={section.id}
            defaultAcceptsLate={policies.assignment.allowLateSubmissionDefault}
            mode={mode}
            now={new Date().toISOString()}
            userId={userId}
          />
        </SectionBlock>

        <SectionBlock
          description="Create quizzes, review attempts, and handle manual grading."
          id="quizzes"
          meta={<SectionBadge>{section.quizzes.length} quizzes</SectionBadge>}
          title={`Quizzes · ${gradeWeights.quizzesWeight}%`}
        >
          <QuizPanel
            classSectionId={section.id}
            mode={mode}
            now={new Date().toISOString()}
            quizzes={section.quizzes.map(toQuizPanelValue)}
            userId={userId}
          />
        </SectionBlock>

        {mode === "instructor" ? (
          <SectionBlock
            description="Scheduled exams for this class section."
            id="exams"
            meta={<SectionBadge>{section.exams.length} exams</SectionBadge>}
            title={`Exams · ${gradeWeights.examsWeight}%`}
          >
            <ExamPanel
              classSectionId={section.id}
              exams={section.exams.map(toExamPanelValue)}
            />
          </SectionBlock>
        ) : null}

        <SectionBlock
          description="Set module weights, calculate final grades, and publish results."
          id="grades"
          meta={<SectionBadge>{section.finalGrades.length} final grades</SectionBadge>}
          title="Grades"
        >
          <GradebookPanel
            classSectionId={section.id}
            mode={mode}
            userId={userId}
            value={toGradebookPanelValue(section)}
          />
        </SectionBlock>

        <SectionBlock
          description="Class announcements, Q&A, resources, and discussion spaces."
          id="boards"
          meta={<SectionBadge>{section.boards.length} boards</SectionBadge>}
          title="Boards"
        >
          <div className="space-y-4">
            {mode === "instructor" ? (
              <details className="rounded-md border bg-background p-3">
                <summary className="cursor-pointer text-sm font-medium">
                  Create class board
                </summary>
                <form
                  action={createClassBoard}
                  className="grid gap-3 pt-3 md:grid-cols-2 xl:grid-cols-4"
                >
                  <input name="classSectionId" type="hidden" value={section.id} />
                  <label className="grid gap-1 text-sm">
                    <span className="font-medium">Board type</span>
                    <select
                      className="h-9 rounded-md border bg-background px-3 text-sm"
                      name="boardKind"
                      defaultValue="CLASS_ANNOUNCEMENTS"
                    >
                      {BOARD_KIND_OPTIONS.filter(
                        (kind) => kind !== "SCHOOL_ANNOUNCEMENTS"
                      ).map((kind) => (
                        <option key={kind} value={kind}>
                          {boardKindLabel(kind)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span className="font-medium">Title</span>
                    <Input
                      name="name"
                      placeholder="Example: Class Q&A"
                      required
                    />
                  </label>
                  <label className="grid gap-1 text-sm md:col-span-2">
                    <span className="font-medium">Description</span>
                    <Input
                      name="description"
                      placeholder="How students and parents should use this board."
                    />
                  </label>
                  <label className="flex items-end gap-2 text-sm">
                    <input name="allowStudentPosts" type="checkbox" />
                    Allow student posts
                  </label>
                  <label className="flex items-end gap-2 text-sm">
                    <input name="allowParentPosts" type="checkbox" />
                    Allow parent posts
                  </label>
                  <label className="flex items-end gap-2 text-sm">
                    <input name="allowComments" type="checkbox" defaultChecked />
                    Allow comments
                  </label>
                  <div className="flex items-end">
                    <Button size="sm" type="submit">
                      Create board
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground md:col-span-2 xl:col-span-4">
                    Attachments will be enabled after file storage
                    stabilization.
                  </p>
                </form>
              </details>
            ) : null}
            {section.boards.length ? (
              <SimpleTable
                empty="No boards yet."
                headers={["Board", "Type", "Posts", "Open"]}
                rows={section.boards.map((board) => {
                  const settings = getBoardSettings(board.settings)
                  const href =
                    mode === "instructor"
                      ? `/instructor/classes/${section.id}/boards/${board.id}`
                      : `/student/classes/${section.id}/boards/${board.id}`

                  return (
                    <TableRow key={board.id}>
                      <TableCell className="font-medium">
                        <div>{board.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {board.description ?? boardKindHelp(settings.boardKind)}
                        </div>
                      </TableCell>
                      <TableCell>{boardKindLabel(settings.boardKind)}</TableCell>
                      <TableCell>{board._count.posts}</TableCell>
                      <TableCell>
                        <OpenButton href={href} />
                      </TableCell>
                    </TableRow>
                  )
                })}
              />
            ) : (
              <EmptyState>No boards yet.</EmptyState>
            )}
            </div>
        </SectionBlock>
      </div>
    </DashboardPage>
  )
}

function LessonPreviewLink({
  lesson,
}: {
  lesson: {
    contentType: string
    videoFileAsset?: { originalName: string } | null
    videoFileAssetId: string | null
    videoUrl: string | null
  }
}) {
  const href = lesson.videoFileAssetId
    ? `/api/files/${lesson.videoFileAssetId}/download?disposition=inline`
    : lesson.videoUrl

  if (lesson.contentType === "FILE") {
    return href ? (
      <Button asChild size="sm" variant="outline">
        <Link href={href} target="_blank">
          Download file
        </Link>
      </Button>
    ) : (
      <span className="text-sm text-muted-foreground">No file</span>
    )
  }

  if (lesson.contentType !== "VIDEO") {
    return <span className="text-sm text-muted-foreground">-</span>
  }

  return href ? (
    <Button asChild size="sm" variant="outline">
      <Link href={href} target="_blank">
        View video
      </Link>
    </Button>
  ) : (
    <span className="text-sm text-muted-foreground">No video</span>
  )
}

function LessonProgressBadge({
  progress,
}: {
  progress?: {
    completed: boolean
    percentComplete: unknown
    progressRate: unknown
  }
}) {
  const percent = Math.round(
    Number(progress?.percentComplete ?? progress?.progressRate ?? 0)
  )
  const complete = progress?.completed || percent >= 100

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold ${
        complete
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-red-200 bg-red-50 text-red-700"
      }`}
    >
      {complete ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
      {complete ? "100%" : `${Math.min(99, Math.max(0, percent))}%`}
    </span>
  )
}

function getLessonProgressRows(
  section: NonNullable<Awaited<ReturnType<typeof getClassSectionDetail>>>,
  lessonId: string
) {
  const lesson = section.lessons.find((item) => item.id === lessonId)
  const progressByStudentId = new Map(
    (lesson?.videoProgress ?? []).map((progress) => [progress.studentId, progress])
  )

  return section.enrollments
    .map((enrollment) => {
      const progress = progressByStudentId.get(enrollment.studentId)
      const progressRate = Number(progress?.progressRate ?? 0)
      const status = progress?.completed
        ? "Completed"
        : progress
          ? "In progress"
          : "Not started"

      return {
        studentId: enrollment.studentId,
        name: enrollment.student.name,
        email: enrollment.student.email ?? "-",
        status,
        statusOrder:
          status === "Completed" ? 0 : status === "In progress" ? 1 : 2,
        watchedSeconds: progress?.watchedSeconds ?? 0,
        durationSeconds:
          progress?.durationSeconds ?? lesson?.durationSeconds ?? 0,
        progressRate,
        lastPositionSeconds: progress?.lastPositionSeconds ?? 0,
        lastWatchedAt: progress?.lastWatchedAt,
        completedAt: progress?.completedAt,
      }
    })
    .sort(
      (left, right) =>
        left.statusOrder - right.statusOrder ||
        left.name.localeCompare(right.name)
    )
}

function AttendanceStat({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <div className="rounded-md border bg-background p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold">{value}</div>
    </div>
  )
}

function SectionBadge({ children }: { children: ReactNode }) {
  return <Badge variant="secondary">{children}</Badge>
}

function formatInstructorNames(
  instructors: NonNullable<
    Awaited<ReturnType<typeof getClassSectionDetail>>
  >["instructors"]
) {
  const names = instructors
    .map((assignment) => assignment.instructor.name ?? assignment.instructor.email)
    .filter((name): name is string => Boolean(name))

  return names.join(", ")
}

function toAssignmentPanelValue(
  assignment: NonNullable<
    Awaited<ReturnType<typeof getClassSectionDetail>>
  >["assignments"][number]
): AssignmentPanelValue {
  return {
    id: assignment.id,
    title: assignment.title,
    description: assignment.description,
    dueAt: assignment.dueAt?.toISOString() ?? null,
    pointsPossible: assignment.pointsPossible?.toString() ?? null,
    acceptsLate: assignment.acceptsLate,
    submissions: assignment.submissions.map((submission) => ({
      id: submission.id,
      studentId: submission.studentId,
      studentName: submission.student.name,
      studentEmail: submission.student.email,
      content: submission.content,
      submittedAt: submission.submittedAt?.toISOString() ?? null,
      score: submission.score?.toString() ?? null,
      feedback: submission.feedback,
      gradedAt: submission.gradedAt?.toISOString() ?? null,
      attachments: submission.attachments.map((attachment) => ({
        id: attachment.id,
        name: attachment.originalName,
      })),
    })),
  }
}

function toLessonFormValue(
  lesson: NonNullable<
    Awaited<ReturnType<typeof getClassSectionDetail>>
  >["lessons"][number]
): LessonFormValue {
  return {
    id: lesson.id,
    title: lesson.title,
    description: lesson.description,
    sequence: lesson.sequence,
    contentType: lesson.contentType,
    videoProvider: lesson.videoProvider,
    videoUrl: lesson.videoUrl,
    videoFileAssetId: lesson.videoFileAssetId,
    durationSeconds: lesson.durationSeconds,
    isPublished: lesson.isPublished,
  }
}

function toQuizPanelValue(
  quiz: NonNullable<
    Awaited<ReturnType<typeof getClassSectionDetail>>
  >["quizzes"][number]
): QuizPanelValue {
  return {
    id: quiz.id,
    title: quiz.title,
    description: quiz.description,
    opensAt: quiz.opensAt?.toISOString() ?? null,
    closesAt: quiz.closesAt?.toISOString() ?? null,
    timeLimitMinutes: quiz.timeLimitMinutes,
    maxAttempts: quiz.maxAttempts,
    pointsPossible: quiz.pointsPossible?.toString() ?? null,
    isPublished: quiz.isPublished,
    showResultsToStudents: quiz.showResultsToStudents,
    shuffleQuestions: quiz.shuffleQuestions,
    questions: quiz.questions.map((question) => ({
      id: question.id,
      type: question.type,
      prompt: question.prompt,
      points: question.points.toString(),
      sequence: question.sequence,
      explanation: getQuestionExplanation(question.rubric),
      answerKey: question.answerKey,
      options: question.options.map((option) => ({
        id: option.id,
        text: option.text,
        isCorrect: option.isCorrect,
        sequence: option.sequence,
      })),
    })),
    attempts: quiz.attempts.map((attempt) => ({
      id: attempt.id,
      studentId: attempt.studentId,
      studentName: attempt.student.name,
      studentEmail: attempt.student.email,
      attemptNumber: attempt.attemptNumber,
      submittedAt: attempt.submittedAt?.toISOString() ?? null,
      score: attempt.score?.toString() ?? null,
      gradedAt: attempt.gradedAt?.toISOString() ?? null,
      answers: attempt.answers.map((answer) => ({
        id: answer.id,
        questionId: answer.questionId,
        questionPrompt: answer.question.prompt,
        questionType: answer.question.type,
        questionPoints: answer.question.points.toString(),
        answerText: answer.answerText,
        selectedOptionText: answer.selectedOption?.text ?? null,
        score: answer.score?.toString() ?? null,
        feedback: answer.feedback,
      })),
    })),
  }
}

function getQuestionExplanation(rubric: unknown) {
  if (!rubric || typeof rubric !== "object" || Array.isArray(rubric)) {
    return null
  }

  const explanation = (rubric as { explanation?: unknown }).explanation
  return typeof explanation === "string" && explanation.length ? explanation : null
}

function toExamPanelValue(
  exam: NonNullable<
    Awaited<ReturnType<typeof getClassSectionDetail>>
  >["exams"][number]
): ExamPanelValue {
  return {
    id: exam.id,
    title: exam.title,
    examType: exam.examType,
    startsAt: exam.startsAt?.toISOString() ?? null,
    endsAt: exam.endsAt?.toISOString() ?? null,
    location: exam.location,
    pointsPossible: exam.pointsPossible?.toString() ?? null,
    weight: exam.weight?.toString() ?? null,
    description: exam.description,
  }
}

function toGradebookPanelValue(
  section: NonNullable<Awaited<ReturnType<typeof getClassSectionDetail>>>
): GradebookPanelValue {
  return {
    categories: section.gradeCategories.map((category) => ({
      id: category.id,
      name: category.name,
      weight: category.weight?.toString() ?? null,
      sequence: category.sequence,
    })),
    enrollments: section.enrollments.map((enrollment) => ({
      id: enrollment.studentId,
      name: enrollment.student.name,
      email: enrollment.student.email,
    })),
    finalGrades: section.finalGrades.map((grade) => ({
      id: grade.id,
      studentId: grade.studentId,
      numericScore: grade.numericScore?.toString() ?? null,
      percentage: grade.percentage?.toString() ?? null,
      letterGrade: grade.letterGrade,
      gradePoint: grade.gradePoint?.toString() ?? null,
      creditsEarned: grade.creditsEarned?.toString() ?? null,
      status: grade.status,
    })),
    gradeItems: section.gradeItems.map((item) => ({
      id: item.id,
      categoryId: item.categoryId,
      title: item.title,
      pointsPossible: item.pointsPossible.toString(),
      weight: item.weight?.toString() ?? null,
      dueAt: item.dueAt?.toISOString() ?? null,
      assignmentId: item.assignmentId,
      quizId: item.quizId,
      examId: item.examId,
      scores: item.scores.map((score) => ({
        id: score.id,
        studentId: score.studentId,
        score: score.score?.toString() ?? null,
        percentage: score.percentage?.toString() ?? null,
        feedback: score.feedback,
        gradedAt: score.gradedAt?.toISOString() ?? null,
      })),
    })),
    moduleBreakdowns: getModuleBreakdowns(section),
    moduleWeights: getModuleWeights(section.gradingConfig),
    sourceOptions: {
      assignments: section.assignments.map((assignment) => ({
        id: assignment.id,
        title: assignment.title,
      })),
      quizzes: section.quizzes.map((quiz) => ({
        id: quiz.id,
        title: quiz.title,
      })),
      exams: section.exams.map((exam) => ({
        id: exam.id,
        title: exam.title,
      })),
    },
  }
}

function getModuleWeights(
  config: NonNullable<
    Awaited<ReturnType<typeof getClassSectionDetail>>
  >["gradingConfig"]
): ModuleGradeWeights {
  return {
    lessonsWeight: config?.lessonsWeight.toString() ?? "10",
    attendanceWeight: config?.attendanceWeight.toString() ?? "20",
    assignmentsWeight: config?.assignmentsWeight.toString() ?? "30",
    quizzesWeight: config?.quizzesWeight.toString() ?? "20",
    examsWeight: config?.examsWeight.toString() ?? "20",
  }
}

function getModuleBreakdowns(
  section: NonNullable<Awaited<ReturnType<typeof getClassSectionDetail>>>
) {
  const weights = getModuleWeights(section.gradingConfig)

  return section.enrollments.map((enrollment) => {
    const scores = getStudentModuleScores(section, enrollment.studentId)
    const contributions = {
      lessonsContribution: (scores.lessonsScore * Number(weights.lessonsWeight)) / 100,
      attendanceContribution:
        (scores.attendanceScore * Number(weights.attendanceWeight)) / 100,
      assignmentsContribution:
        (scores.assignmentsScore * Number(weights.assignmentsWeight)) / 100,
      quizzesContribution: (scores.quizzesScore * Number(weights.quizzesWeight)) / 100,
      examsContribution: (scores.examsScore * Number(weights.examsWeight)) / 100,
    }
    const totalScore = Object.values(contributions).reduce(
      (total, value) => total + value,
      0
    )

    return {
      studentId: enrollment.studentId,
      lessonsScore: formatPercent(scores.lessonsScore),
      lessonsContribution: formatPercent(contributions.lessonsContribution),
      attendanceScore: formatPercent(scores.attendanceScore),
      attendanceContribution: formatPercent(contributions.attendanceContribution),
      assignmentsScore: formatPercent(scores.assignmentsScore),
      assignmentsContribution: formatPercent(contributions.assignmentsContribution),
      quizzesScore: formatPercent(scores.quizzesScore),
      quizzesContribution: formatPercent(contributions.quizzesContribution),
      examsScore: formatPercent(scores.examsScore),
      examsContribution: formatPercent(contributions.examsContribution),
      totalScore: formatPercent(totalScore),
    }
  })
}

function getStudentModuleScores(
  section: NonNullable<Awaited<ReturnType<typeof getClassSectionDetail>>>,
  studentId: string
) {
  const now = new Date()
  const publishedLessons = section.lessons.filter((lesson) => lesson.isPublished)
  const completedLessons = publishedLessons.filter((lesson) =>
    lesson.videoProgress.some(
      (progress) => progress.studentId === studentId && progress.completed
    )
  ).length
  const lessonsScore = publishedLessons.length
    ? (completedLessons / publishedLessons.length) * 100
    : 0

  const attendanceRecords = section.attendanceSessions.flatMap((session) =>
    session.records.filter((record) => record.studentId === studentId)
  )
  const countedAttendance = attendanceRecords.filter(
    (record) => record.status !== AttendanceStatus.PENDING
  )
  const attendanceScore = countedAttendance.length
    ? countedAttendance.reduce((sum, record) => sum + attendanceStatusPoints(record.status), 0) /
      countedAttendance.length
    : 0

  const gradedAssignments = section.assignments.filter(
    (assignment) =>
      assignment.dueAt === null ||
      assignment.dueAt <= now ||
      assignment.submissions.some((submission) => submission.studentId === studentId)
  )
  const assignmentTotals = gradedAssignments.reduce(
    (totals, assignment) => {
      const possible = Number(assignment.pointsPossible ?? 100)
      const submission = assignment.submissions.find(
        (entry) => entry.studentId === studentId
      )
      return {
        earned: totals.earned + Number(submission?.score ?? 0),
        possible: totals.possible + possible,
      }
    },
    { earned: 0, possible: 0 }
  )
  const assignmentsScore = assignmentTotals.possible
    ? (assignmentTotals.earned / assignmentTotals.possible) * 100
    : 0

  const quizTotals = section.quizzes.reduce(
    (totals, quiz) => {
      const possible =
        Number(quiz.pointsPossible ?? 0) ||
        quiz.questions.reduce((sum, question) => sum + Number(question.points), 0)
      if (!possible) return totals
      const best = quiz.attempts
        .filter((attempt) => attempt.studentId === studentId && attempt.submittedAt)
        .reduce((current, attempt) => {
          const score = Number(attempt.score ?? 0)
          return Math.max(current, score)
        }, 0)
      return {
        earned: totals.earned + best,
        possible: totals.possible + possible,
      }
    },
    { earned: 0, possible: 0 }
  )
  const quizzesScore = quizTotals.possible
    ? (quizTotals.earned / quizTotals.possible) * 100
    : 0

  return {
    lessonsScore,
    attendanceScore,
    assignmentsScore,
    quizzesScore,
    examsScore: 0,
  }
}

function attendanceStatusPoints(status: AttendanceStatus) {
  if (status === AttendanceStatus.PRESENT) return 100
  if (status === AttendanceStatus.LATE) return 50
  if (
    status === AttendanceStatus.EXCUSED ||
    status === AttendanceStatus.SICK_LEAVE ||
    status === AttendanceStatus.OFFICIAL_ABSENCE
  ) {
    return 100
  }
  return 0
}

function formatPercent(value: number) {
  return value.toFixed(1)
}
