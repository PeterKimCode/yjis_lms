import {
  DashboardPage,
  MetricCard,
  OpenButton,
  SimpleTable,
  TableCell,
  TableRow,
} from "@/modules/dashboards/components"
import { getStudentClasses } from "@/modules/dashboards/data"

export default async function StudentPage() {
  const { enrollments } = await getStudentClasses()

  return (
    <DashboardPage
      title="Student dashboard"
      description="Your enrolled classes, coursework, and learning progress."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard href="/student/classes" label="Classes" value={enrollments.length} />
        <MetricCard
          label="Lessons"
          value={enrollments.reduce(
            (total, item) => total + item.classSection._count.lessons,
            0
          )}
        />
        <MetricCard
          label="Assignments"
          value={enrollments.reduce(
            (total, item) => total + item.classSection._count.assignments,
            0
          )}
        />
      </div>
      <StudentClassTable enrollments={enrollments} />
    </DashboardPage>
  )
}

function StudentClassTable({
  enrollments,
}: {
  enrollments: Awaited<ReturnType<typeof getStudentClasses>>["enrollments"]
}) {
  return (
    <SimpleTable
      empty="No enrolled class sections yet."
      headers={["Class", "Course", "Term", "Campus", "Status", "Open"]}
      rows={enrollments.map((enrollment) => (
        <TableRow key={enrollment.id}>
          <TableCell className="font-medium">
            {enrollment.classSection.name}
          </TableCell>
          <TableCell>{enrollment.classSection.course.title}</TableCell>
          <TableCell>{enrollment.classSection.term?.name ?? "No term"}</TableCell>
          <TableCell>
            {enrollment.classSection.campus?.name ?? "Organization-wide"}
          </TableCell>
          <TableCell>{enrollment.status}</TableCell>
          <TableCell>
            <OpenButton href={`/student/classes/${enrollment.classSectionId}`} />
          </TableCell>
        </TableRow>
      ))}
    />
  )
}
