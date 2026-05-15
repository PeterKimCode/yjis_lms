import Link from "next/link"

import { Button } from "@/components/ui/button"
import { ClassSectionForm } from "@/modules/admin/academic-management"
import {
  AdminPageHeader,
  DataTable,
  matchesSearch,
  SearchForm,
  TableCell,
  TableRow,
} from "@/modules/admin/components"
import { getAcademicSetupOptions } from "@/modules/admin/data"

export default async function ClassSectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const data = await getAcademicSetupOptions()
  const q = (await searchParams).q?.trim() ?? ""
  const classSections = data.classSections.filter((section) =>
    matchesSearch(q, [
      section.name,
      section.sectionCode,
      section.course.title,
      section.course.code,
      section.term?.name,
      section.campus?.name,
      section.instructors.map((item) => item.instructor.name).join(" "),
    ])
  )

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Class sections"
        description="Open course sections, assigned instructors, and enrollment counts."
      />
      <SearchForm q={q} placeholder="Search sections, courses, terms..." />
      <ClassSectionForm data={data} />
      <DataTable
        empty="No class sections match your search."
        headers={[
          "Section",
          "Course",
          "Term",
          "Campus",
          "Mode",
          "Credit",
          "Instructors",
          "Students",
          "Actions",
        ]}
        minWidth="min-w-[1040px]"
        rows={classSections.map((section) => {
          const primary =
            section.instructors.find((item) => item.isPrimary) ??
            section.instructors[0]
          const extraInstructorCount = Math.max(0, section.instructors.length - 1)
          const studentCount = section._count.enrollments

          return (
            <TableRow key={section.id}>
              <TableCell className="max-w-[220px] font-medium">
                <Link
                  className="block truncate text-primary underline-offset-4 hover:underline"
                  href={`/admin/class-sections/${section.id}`}
                  title={section.name}
                >
                  {section.name}
                </Link>
                <div className="truncate text-xs text-muted-foreground">
                  {section.sectionCode ?? "No section code"}
                </div>
              </TableCell>
              <TableCell className="max-w-[180px] truncate" title={section.course.title}>
                {section.course.title}
              </TableCell>
              <TableCell className="max-w-[140px] truncate">
                {section.term?.name ?? "-"}
              </TableCell>
              <TableCell className="max-w-[180px] truncate">
                {section.campus?.name ?? "Organization-wide"}
              </TableCell>
              <TableCell className="whitespace-nowrap">{section.deliveryMode}</TableCell>
              <TableCell className="whitespace-nowrap">
                {section.course.credits?.toString() ?? "-"}
              </TableCell>
              <TableCell className="max-w-[180px]">
                {primary ? (
                  <span className="block truncate" title={primary.instructor.name}>
                    {primary.instructor.name}
                    {extraInstructorCount ? ` +${extraInstructorCount} more` : ""}
                  </span>
                ) : (
                  "Unassigned"
                )}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {studentCount} {studentCount === 1 ? "student" : "students"}
              </TableCell>
              <TableCell>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/admin/class-sections/${section.id}`}>View</Link>
                </Button>
              </TableCell>
            </TableRow>
          )
        })}
      />
    </div>
  )
}
