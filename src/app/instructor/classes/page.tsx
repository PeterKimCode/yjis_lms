import Link from "next/link"
import type { ReactNode } from "react"

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
          <LinkedCell
            className="font-medium"
            href={`/instructor/classes/${section.id}`}
          >
            {section.name}
          </LinkedCell>
          <LinkedCell href={`/instructor/classes/${section.id}`}>
            {section.course.title}
          </LinkedCell>
          <LinkedCell href={`/instructor/classes/${section.id}`}>
            {section.term?.name ?? "No term"}
          </LinkedCell>
          <LinkedCell href={`/instructor/classes/${section.id}`}>
            {section.campus?.name ?? "Organization-wide"}
          </LinkedCell>
          <LinkedCell href={`/instructor/classes/${section.id}`}>
            {section._count.enrollments}
          </LinkedCell>
          <TableCell>
            <OpenButton href={`/instructor/classes/${section.id}`} />
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
