import {
  DashboardPage,
  OpenButton,
  SimpleTable,
  TableCell,
  TableRow,
} from "@/modules/dashboards/components"
import { getParentStudents } from "@/modules/dashboards/data"

export default async function ParentStudentsPage() {
  const { relations } = await getParentStudents()

  return (
    <DashboardPage
      title="Linked students"
      description="Students connected to your parent or guardian account."
    >
      <SimpleTable
        empty="No linked students yet."
        headers={["Student", "Relation", "Grade", "Campus", "Classes", "Open"]}
        rows={relations.map((relation) => (
          <TableRow key={relation.id}>
            <TableCell className="font-medium">{relation.student.name}</TableCell>
            <TableCell>{relation.relation}</TableCell>
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
    </DashboardPage>
  )
}
