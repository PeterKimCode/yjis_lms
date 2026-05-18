import {
  DashboardPage,
  MetricCard,
  OpenButton,
  SimpleTable,
  TableCell,
  TableRow,
} from "@/modules/dashboards/components"
import { getInstructorClasses } from "@/modules/dashboards/data"

export default async function InstructorPage() {
  const { classSections } = await getInstructorClasses()

  return (
    <DashboardPage
      title="Instructor dashboard"
      description="Assigned class sections, learning activity, and teaching setup."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard href="/instructor/classes" label="Classes" value={classSections.length} />
        <MetricCard href="/messages" label="Messages" value="Open" />
        <MetricCard
          label="Students"
          value={classSections.reduce(
            (total, section) => total + section._count.enrollments,
            0
          )}
        />
        <MetricCard
          label="Open coursework"
          value={classSections.reduce(
            (total, section) =>
              total + section._count.assignments + section._count.quizzes,
            0
          )}
        />
      </div>
      <InstructorClassTable classSections={classSections} />
    </DashboardPage>
  )
}

function InstructorClassTable({
  classSections,
}: {
  classSections: Awaited<ReturnType<typeof getInstructorClasses>>["classSections"]
}) {
  return (
    <SimpleTable
      empty="No assigned class sections yet."
      headers={["Class", "Course", "Term", "Campus", "Students", "Open"]}
      rows={classSections.map((section) => (
        <TableRow key={section.id}>
          <TableCell className="font-medium">{section.name}</TableCell>
          <TableCell>{section.course.title}</TableCell>
          <TableCell>{section.term?.name ?? "No term"}</TableCell>
          <TableCell>{section.campus?.name ?? "Organization-wide"}</TableCell>
          <TableCell>{section._count.enrollments}</TableCell>
          <TableCell>
            <OpenButton href={`/instructor/classes/${section.id}`} />
          </TableCell>
        </TableRow>
      ))}
    />
  )
}
