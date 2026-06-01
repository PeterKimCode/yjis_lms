import Link from "next/link"
import type { ReactNode } from "react"

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
            <LinkedCell
              className="font-medium"
              href={`/student/classes/${enrollment.classSectionId}`}
            >
              {enrollment.classSection.name}
            </LinkedCell>
            <LinkedCell href={`/student/classes/${enrollment.classSectionId}`}>
              {enrollment.classSection.course.title}
            </LinkedCell>
            <LinkedCell href={`/student/classes/${enrollment.classSectionId}`}>
              {enrollment.classSection.term?.name ?? "No term"}
            </LinkedCell>
            <LinkedCell href={`/student/classes/${enrollment.classSectionId}`}>
              {enrollment.classSection.campus?.name ?? "Organization-wide"}
            </LinkedCell>
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

function LinkedCell({
  href,
  children,
  className,
}: {
  href: string
  children: ReactNode
  className?: string
}) {
  return (
    <TableCell className={className}>
      <Link className="-m-3 block p-3 hover:text-primary" href={href}>
        {children}
      </Link>
    </TableCell>
  )
}
