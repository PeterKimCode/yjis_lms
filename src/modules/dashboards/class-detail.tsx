import { LessonContentType } from "@prisma/client"
import { notFound } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { deleteLesson, saveLesson } from "@/modules/learning/actions"
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
} from "@/modules/dashboards/data"

type ClassSectionDetailMode = "instructor" | "student"

type LessonForDetail = NonNullable<
  Awaited<ReturnType<typeof getClassSectionDetail>>
>["lessons"][number]

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
              <LessonForm classSectionId={section.id} />
            ) : null}
            <SimpleTable
              empty={
                mode === "instructor"
                  ? "No lessons yet."
                  : "No published lessons yet."
              }
              headers={
                mode === "instructor"
                  ? ["Order", "Title", "Type", "Published", "Completion", "Edit"]
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
                        <TableCell>{lesson.isPublished ? "Yes" : "No"}</TableCell>
                        <TableCell>
                          {completedCount}/{enrollmentCount}
                        </TableCell>
                        <TableCell>
                          <LessonForm classSectionId={section.id} lesson={lesson} />
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

function LessonForm({
  classSectionId,
  lesson,
}: {
  classSectionId: string
  lesson?: LessonForDetail
}) {
  const isEditing = Boolean(lesson)

  return (
    <form action={saveLesson} className="space-y-3 rounded-md border p-3">
      <input name="id" type="hidden" value={lesson?.id ?? ""} />
      <input name="classSectionId" type="hidden" value={classSectionId} />
      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Title</span>
          <Input name="title" required defaultValue={lesson?.title ?? ""} />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Order</span>
          <Input
            min={1}
            name="sequence"
            required
            type="number"
            defaultValue={lesson?.sequence ?? 1}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Content type</span>
          <select
            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
            name="contentType"
            defaultValue={lesson?.contentType ?? LessonContentType.TEXT}
          >
            {Object.values(LessonContentType).map((contentType) => (
              <option key={contentType} value={contentType}>
                {contentType}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Duration seconds</span>
          <Input
            min={0}
            name="durationSeconds"
            type="number"
            defaultValue={lesson?.durationSeconds ?? ""}
          />
        </label>
        <label className="space-y-1 text-sm md:col-span-2">
          <span className="font-medium">Video URL</span>
          <Input name="videoUrl" defaultValue={lesson?.videoUrl ?? ""} />
        </label>
        <label className="space-y-1 text-sm md:col-span-2">
          <span className="font-medium">Video file ID</span>
          <Input
            name="videoFileAssetId"
            defaultValue={lesson?.videoFileAssetId ?? ""}
          />
        </label>
        <label className="space-y-1 text-sm md:col-span-2">
          <span className="font-medium">Description</span>
          <Textarea
            name="description"
            rows={3}
            defaultValue={lesson?.description ?? ""}
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          className="size-4"
          name="isPublished"
          type="checkbox"
          defaultChecked={lesson?.isPublished ?? false}
        />
        Published
      </label>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" type="submit">
          {isEditing ? "Save lesson" : "Create lesson"}
        </Button>
        {lesson ? (
          <Button
            formAction={deleteLesson}
            name="lessonId"
            size="sm"
            type="submit"
            value={lesson.id}
            variant="destructive"
          >
            Delete
          </Button>
        ) : null}
      </div>
    </form>
  )
}
