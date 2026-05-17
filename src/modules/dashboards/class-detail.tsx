import { notFound } from "next/navigation"
import Link from "next/link"
import { AttendanceStatus, DeliveryMode } from "@prisma/client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DashboardPage,
  EmptyState,
  MetricCard,
  OpenButton,
  SectionBlock,
  SimpleTable,
  TableCell,
  TableRow,
} from "@/modules/dashboards/components"
import {
  formatDate,
  formatDateTime,
  getAttendancePolicyForOrganization,
  getClassSectionDetail,
  getVideoFileOptionsForClassSection,
} from "@/modules/dashboards/data"
import { LessonForm, type LessonFormValue } from "@/modules/learning/lesson-form"
import {
  createAttendanceSession,
  createClassSession,
  saveAttendanceRecord,
} from "@/modules/attendance/actions"
import {
  getAttendanceSummary,
  normalizeAttendancePolicy,
} from "@/modules/attendance/summary"

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
  const attendancePolicy = normalizeAttendancePolicy(
    await getAttendancePolicyForOrganization(section.organizationId)
  )
  const visibleAttendanceRecords =
    mode === "student"
      ? section.attendanceSessions.flatMap((session) =>
          session.records.filter((record) => record.studentId === userId)
        )
      : section.attendanceSessions.flatMap((session) => session.records)
  const attendanceSummary = getAttendanceSummary(
    visibleAttendanceRecords,
    attendancePolicy
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

  return (
    <DashboardPage
      title={section.name}
      description={`${section.course.title} - ${
        section.campus?.name ?? "Organization-wide"
      } - ${section.term?.name ?? "No term"}`}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Students" value={section._count.enrollments} />
        <MetricCard label="Lessons" value={section.lessons.length} />
        <MetricCard label="Assignments" value={section.assignments.length} />
        <MetricCard label="Quizzes" value={section.quizzes.length} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionBlock title="Lessons">
          <div className="space-y-4">
            {mode === "instructor" ? (
              <LessonForm
                classSectionId={section.id}
                videoFileOptions={videoFileOptions}
              />
            ) : null}
            <SimpleTable
              empty={
                mode === "instructor"
                  ? "No lessons yet."
                  : "No published lessons yet."
              }
              headers={
                mode === "instructor"
                  ? ["Order", "Title", "Type", "Video", "Published", "Completion"]
                  : ["Order", "Title", "Type", "Duration", "Open"]
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
                        <TableCell>{lesson.isPublished ? "Yes" : "No"}</TableCell>
                        <TableCell>
                          <Link
                            className="text-primary underline-offset-4 hover:underline"
                            href={`/instructor/classes/${section.id}?lessonId=${lesson.id}#lesson-progress`}
                          >
                            {completedCount}/{enrollmentCount}
                          </Link>
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell>
                          {lesson.durationSeconds
                            ? `${lesson.durationSeconds}s`
                            : "-"}
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
            {mode === "instructor" && section.lessons.length ? (
              <div className="space-y-3">
                <h3 className="text-sm font-medium">Edit lessons</h3>
                {section.lessons.map((lesson) => (
                  <details
                    className="rounded-md border bg-background p-3"
                    key={lesson.id}
                  >
                    <summary className="cursor-pointer text-sm font-medium">
                      {lesson.sequence}. {lesson.title}
                    </summary>
                    <div className="pt-3">
                      <LessonForm
                        classSectionId={section.id}
                        lesson={toLessonFormValue(lesson)}
                        videoFileOptions={videoFileOptions}
                      />
                    </div>
                  </details>
                ))}
              </div>
            ) : null}
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

        <SectionBlock title="Sessions">
          {mode === "instructor" ? (
            <form
              action={createClassSession}
              className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3"
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

        <SectionBlock title="Attendance">
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
                {attendancePolicy.lateThresholdMinutes ?? "not set"} minutes,
                late counts as absence:{" "}
                {attendancePolicy.countLateAsAbsence ? "yes" : "no"}, override:{" "}
                {attendancePolicy.allowInstructorOverride ? "allowed" : "blocked"},
                absence fail threshold:{" "}
                {attendancePolicy.absenceFailThresholdRate
                  ? `${attendancePolicy.absenceFailThresholdRate}%`
                  : "not set"}.
              </p>
            ) : null}
            {mode === "instructor" ? (
              section.attendanceSessions.length ? (
                <div className="space-y-3">
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
                        <SimpleTable
                          empty="No attendance records were created."
                          headers={["Student", "Email", "Status", "Note", "Save"]}
                          rows={attendance.records.map((record) => (
                            <TableRow key={record.id}>
                              <TableCell className="font-medium">
                                {record.student.name}
                              </TableCell>
                              <TableCell>{record.student.email ?? "-"}</TableCell>
                              <TableCell>
                                <form
                                  action={saveAttendanceRecord}
                                  className="contents"
                                  id={`attendance-${record.id}`}
                                >
                                  <input
                                    name="attendanceSessionId"
                                    type="hidden"
                                    value={attendance.id}
                                  />
                                  <input
                                    name="studentId"
                                    type="hidden"
                                    value={record.studentId}
                                  />
                                  <select
                                    className="h-8 rounded-md border bg-background px-2 text-sm"
                                    name="status"
                                    defaultValue={record.status}
                                  >
                                    {Object.values(AttendanceStatus).map(
                                      (status) => (
                                        <option key={status} value={status}>
                                          {status}
                                        </option>
                                      )
                                    )}
                                  </select>
                                </form>
                              </TableCell>
                              <TableCell>
                                <Input
                                  form={`attendance-${record.id}`}
                                  name="note"
                                  defaultValue={record.note ?? ""}
                                  placeholder="Optional"
                                />
                              </TableCell>
                              <TableCell>
                                <Button
                                  form={`attendance-${record.id}`}
                                  size="sm"
                                  type="submit"
                                  variant="outline"
                                >
                                  Save
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        />
                      </div>
                    </details>
                  ))}
                </div>
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
                        <TableCell>{record.status}</TableCell>
                        <TableCell>{record.note ?? "-"}</TableCell>
                      </TableRow>
                    ))
                )}
              />
            )}
          </div>
        </SectionBlock>

        <SectionBlock title="Assignments">
          <SimpleTable
            empty="No assignments yet."
            headers={["Title", "Due", "Points"]}
            rows={section.assignments.map((assignment) => (
              <TableRow key={assignment.id}>
                <TableCell className="font-medium">{assignment.title}</TableCell>
                <TableCell>{formatDate(assignment.dueAt)}</TableCell>
                <TableCell>
                  {assignment.pointsPossible?.toString() ?? "-"}
                </TableCell>
              </TableRow>
            ))}
          />
        </SectionBlock>

        <SectionBlock title="Quizzes">
          <SimpleTable
            empty="No quizzes yet."
            headers={["Title", "Opens", "Points"]}
            rows={section.quizzes.map((quiz) => (
              <TableRow key={quiz.id}>
                <TableCell className="font-medium">{quiz.title}</TableCell>
                <TableCell>{formatDateTime(quiz.opensAt)}</TableCell>
                <TableCell>{quiz.pointsPossible?.toString() ?? "-"}</TableCell>
              </TableRow>
            ))}
          />
        </SectionBlock>

        <SectionBlock title="Grades">
          <SimpleTable
            empty="No grade items yet."
            headers={["Title", "Points", "Weight"]}
            rows={section.gradeItems.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.title}</TableCell>
                <TableCell>{item.pointsPossible.toString()}</TableCell>
                <TableCell>{item.weight?.toString() ?? "-"}</TableCell>
              </TableRow>
            ))}
          />
        </SectionBlock>

        <SectionBlock title="Boards">
          {section.boards.length ? (
            <div className="flex flex-wrap gap-2">
              {section.boards.map((board) => (
                <span
                  className="rounded-md border bg-background px-3 py-2 text-sm"
                  key={board.id}
                >
                  {board.name} - {board.type}
                </span>
              ))}
            </div>
          ) : (
            <EmptyState>No boards yet.</EmptyState>
          )}
        </SectionBlock>
      </div>
    </DashboardPage>
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
