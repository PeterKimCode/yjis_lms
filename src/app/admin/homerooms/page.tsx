import Link from "next/link"

import { Button } from "@/components/ui/button"
import { deleteAdminEntity } from "@/modules/admin/actions"
import { HomeroomForm } from "@/modules/admin/academic-management"
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

export default async function HomeroomsPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string; deleteError?: string; q?: string }>
}) {
  const data = await getAcademicSetupOptions()
  const params = await searchParams
  const q = params.q?.trim() ?? ""
  const homerooms = data.homerooms.filter((homeroom) =>
    matchesSearch(q, [
      homeroom.name,
      homeroom.gradeLevel?.name,
      homeroom.campus?.name,
      homeroom.teacher?.name,
      homeroom.teacher?.email,
    ])
  )

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Homerooms"
        description="Manage K-12 homerooms, advisor assignments, and student placement."
      />
      <DeleteStatusBanner deleted={params.deleted} deleteError={params.deleteError} />
      <SearchForm q={q} placeholder="Search homerooms, grades, teachers..." />
      <HomeroomForm data={data} />
      <DataTable
        empty="No homerooms match your search."
        headers={[
          "Homeroom",
          "Grade Level",
          "Campus",
          "Homeroom Teacher",
          "Students",
          "Actions",
        ]}
        minWidth="min-w-[860px]"
        rows={homerooms.map((homeroom) => (
          <TableRow key={homeroom.id}>
            <TableCell className="max-w-[220px] font-medium">
              <Link
                className="block truncate text-primary underline-offset-4 hover:underline"
                href={`/admin/homerooms/${homeroom.id}`}
                title={homeroom.name}
              >
                {homeroom.name}
              </Link>
            </TableCell>
            <TableCell>{homeroom.gradeLevel?.name ?? "-"}</TableCell>
            <TableCell className="max-w-[180px] truncate">
              {homeroom.campus?.name ?? "Organization-wide"}
            </TableCell>
            <TableCell className="max-w-[220px] truncate">
              {homeroom.teacher
                ? `${homeroom.teacher.name}${
                    homeroom.teacher.email ? ` (${homeroom.teacher.email})` : ""
                  }`
                : "-"}
            </TableCell>
            <TableCell className="whitespace-nowrap">
              {homeroom._count.studentProfiles}{" "}
              {homeroom._count.studentProfiles === 1 ? "student" : "students"}
            </TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href={`/admin/homerooms/${homeroom.id}`}>View</Link>
                </Button>
                <ConfirmDeleteForm
                  action={deleteAdminEntity}
                  entity="homeroom"
                  id={homeroom.id}
                  message={`Delete homeroom "${homeroom.name}"? Related students may prevent deletion.`}
                  returnPath="/admin/homerooms"
                />
              </div>
            </TableCell>
          </TableRow>
        ))}
      />
    </div>
  )
}
