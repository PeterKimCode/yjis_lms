import {
  DashboardPage,
  OpenButton,
  SimpleTable,
  TableCell,
  TableRow,
} from "@/modules/dashboards/components"
import { getInstructorClasses } from "@/modules/dashboards/data"

export default async function InstructorClassesPage() {
  const { classSections } = await getInstructorClasses()

  return (
    <DashboardPage
      title="Instructor classes"
      description="Class sections assigned directly to you or linked to your homeroom."
    >
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
    </DashboardPage>
  )
}
