import {
  DashboardPage,
  MetricCard,
  OpenButton,
  SimpleTable,
  TableCell,
  TableRow,
} from "@/modules/dashboards/components"
import { getParentStudents } from "@/modules/dashboards/data"

export default async function ParentPage() {
  const { relations } = await getParentStudents()

  return (
    <DashboardPage
      title="Parent dashboard"
      description="Linked students and their current learning activity."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard href="/parent/students" label="Students" value={relations.length} />
        <MetricCard href="/messages" label="Messages" value="Open" />
        <MetricCard
          label="Classes"
          value={relations.reduce(
            (total, relation) => total + relation.student.enrollments.length,
            0
          )}
        />
        <MetricCard
          label="Primary links"
          value={relations.filter((relation) => relation.isPrimary).length}
        />
      </div>
      <ParentStudentsTable relations={relations} />
    </DashboardPage>
  )
}

function ParentStudentsTable({
  relations,
}: {
  relations: Awaited<ReturnType<typeof getParentStudents>>["relations"]
}) {
  return (
    <SimpleTable
      empty="No linked students yet."
      headers={["Student", "Grade", "Campus", "Classes", "Open"]}
      rows={relations.map((relation) => (
        <TableRow key={relation.id}>
          <TableCell className="font-medium">{relation.student.name}</TableCell>
          <TableCell>
            {relation.student.studentProfile?.currentGradeLevel?.name ?? "-"}
          </TableCell>
          <TableCell>
            {relation.student.studentProfile?.campus?.name ?? "Organization-wide"}
          </TableCell>
          <TableCell>{relation.student.enrollments.length}</TableCell>
          <TableCell>
            <OpenButton href={`/parent/students/${relation.studentId}`} />
          </TableCell>
        </TableRow>
      ))}
    />
  )
}
