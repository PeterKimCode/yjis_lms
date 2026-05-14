import {
  DashboardPage,
  OpenButton,
  SimpleTable,
  TableCell,
  TableRow,
} from "@/modules/dashboards/components"
import { getStudentClasses } from "@/modules/dashboards/data"

export default async function StudentClassesPage() {
  const { enrollments } = await getStudentClasses()

  return (
    <DashboardPage
      title="My classes"
      description="Class sections where you are enrolled."
    >
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
    </DashboardPage>
  )
}
