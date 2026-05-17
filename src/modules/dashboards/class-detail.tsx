import { notFound } from "next/navigation"
import Link from "next/link"

import { Button } from "@/components/ui/button"
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
  getClassSectionDetail,
  getVideoFileOptionsForClassSection,
} from "@/modules/dashboards/data"
import { LessonForm, type LessonFormValue } from "@/modules/learning/lesson-form"

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
          <SimpleTable
            empty="No class sessions yet."
            headers={["Title", "Starts", "Mode"]}
            rows={section.sessions.map((session) => (
              <TableRow key={session.id}>
                <TableCell className="font-medium">
                  {session.title ?? "Class session"}
                </TableCell>
                <TableCell>{formatDateTime(session.startsAt)}</TableCell>
                <TableCell>{session.deliveryMode}</TableCell>
              </TableRow>
            ))}
          />
        </SectionBlock>

        <SectionBlock title="Attendance">
          <SimpleTable
            empty="No attendance sessions yet."
            headers={["Title", "Taken", "Records"]}
            rows={section.attendanceSessions.map((attendance) => (
              <TableRow key={attendance.id}>
                <TableCell className="font-medium">
                  {attendance.title ?? "Attendance"}
                </TableCell>
                <TableCell>{formatDateTime(attendance.takenAt)}</TableCell>
                <TableCell>{attendance.records.length}</TableCell>
              </TableRow>
            ))}
          />
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
