import { notFound } from "next/navigation"

import {
  DashboardPage,
  EmptyState,
  MetricCard,
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

export async function ClassSectionDetail({
  userId,
  classSectionId,
}: {
  userId: string
  classSectionId: string
}) {
  const section = await getClassSectionDetail(userId, classSectionId)

  if (!section) {
    notFound()
  }

  return (
    <DashboardPage
      title={section.name}
      description={`${section.course.title} · ${
        section.campus?.name ?? "Organization-wide"
      } · ${section.term?.name ?? "No term"}`}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Students" value={section._count.enrollments} />
        <MetricCard label="Lessons" value={section.lessons.length} />
        <MetricCard label="Assignments" value={section.assignments.length} />
        <MetricCard label="Quizzes" value={section.quizzes.length} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionBlock title="Lessons">
          <SimpleTable
            empty="No lessons yet."
            headers={["Title", "Type", "Materials"]}
            rows={section.lessons.map((lesson) => (
              <TableRow key={lesson.id}>
                <TableCell className="font-medium">{lesson.title}</TableCell>
                <TableCell>{lesson.contentType}</TableCell>
                <TableCell>{lesson.materials.length}</TableCell>
              </TableRow>
            ))}
          />
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
                <TableCell>{assignment.pointsPossible?.toString() ?? "-"}</TableCell>
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
                  {board.name} · {board.type}
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
