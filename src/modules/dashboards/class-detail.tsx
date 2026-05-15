import { notFound } from "next/navigation"

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
}: {
  userId: string
  classSectionId: string
  mode?: ClassSectionDetailMode
}) {
  const section = await getClassSectionDetail(userId, classSectionId, {
    publishedLessonsOnly: mode === "student",
  })

  if (!section) {
    notFound()
  }

  const enrollmentCount = section.enrollments.length
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
                          {completedCount}/{enrollmentCount}
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
