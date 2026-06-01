import Link from "next/link"

import { Button } from "@/components/ui/button"
import { deleteAdminEntity } from "@/modules/admin/actions"
import { ClassSectionForm } from "@/modules/admin/academic-management"
import {
  AdminPageHeader,
  DataTable,
  DeleteStatusBanner,
  matchesSearch,
  SearchForm,
  TableCell,
  TableRow,
} from "@/modules/admin/components"
import { getAcademicSetupOptions } from "@/modules/admin/data"
import { ConfirmDeleteForm } from "@/modules/admin/delete-button"

export default async function ClassSectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string; deleteError?: string; q?: string }>
}) {
  const data = await getAcademicSetupOptions()
  const params = await searchParams
  const q = params.q?.trim() ?? ""
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
      <SearchForm
        q={q}
        placeholder="Search sections, courses, terms..."
        resultSummary={`${classSections.length} of ${data.classSections.length} class sections shown`}
      />
      <DeleteStatusBanner deleted={params.deleted} deleteError={params.deleteError} />
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
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/admin/class-sections/${section.id}`}>View</Link>
                  </Button>
                  <ConfirmDeleteForm
                    action={deleteAdminEntity}
                    entity="classSection"
                    id={section.id}
                    message={`Delete class section "${section.name}"? Related class records may be removed or prevent deletion.`}
                    returnPath="/admin/class-sections"
                  />
                </div>
              </TableCell>
            </TableRow>
          )
        })}
      />
    </div>
  )
}
