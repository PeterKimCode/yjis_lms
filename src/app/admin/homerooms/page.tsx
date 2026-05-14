import { saveHomeroom } from "@/modules/admin/actions"
import {
  AdminPageHeader,
  AdminSelect,
  DataTable,
  Field,
  FormCard,
  SubmitButton,
  TableCell,
  TableRow,
} from "@/modules/admin/components"
import { getAcademicSetupOptions } from "@/modules/admin/data"

export default async function HomeroomsPage() {
  const data = await getAcademicSetupOptions()

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Homerooms"
        description="Manage K-12 homerooms and advisor assignments."
      />
      <HomeroomForm data={data} />
      <DataTable
        empty="No homerooms yet."
        headers={["Name", "Grade", "Academic Year", "Teacher", "Edit"]}
        rows={data.homerooms.map((homeroom) => (
          <TableRow key={homeroom.id}>
            <TableCell className="font-medium">{homeroom.name}</TableCell>
            <TableCell>
              {data.gradeLevels.find((grade) => grade.id === homeroom.gradeLevelId)
                ?.name ?? "-"}
            </TableCell>
            <TableCell>
              {data.academicYears.find(
                (year) => year.id === homeroom.academicYearId
              )?.name ?? "-"}
            </TableCell>
            <TableCell>
              {data.userOptions.find((user) => user.id === homeroom.teacherId)
                ?.label ?? "-"}
            </TableCell>
            <TableCell>
              <HomeroomForm data={data} homeroom={homeroom} />
            </TableCell>
          </TableRow>
        ))}
      />
    </div>
  )
}

function HomeroomForm({
  data,
  homeroom,
}: {
  data: Awaited<ReturnType<typeof getAcademicSetupOptions>>
  homeroom?: {
    id: string
    organizationId: string
    campusId: string | null
    academicYearId: string
    gradeLevelId: string | null
    teacherId: string | null
    name: string
  }
}) {
  return (
    <FormCard title={homeroom ? "Edit homeroom" : "Create homeroom"}>
      <form action={saveHomeroom} className="grid gap-3 md:grid-cols-4">
        <input name="id" type="hidden" value={homeroom?.id ?? ""} />
        <AdminSelect
          includeEmpty={false}
          label="Organization"
          name="organizationId"
          options={data.organizationOptions}
          defaultValue={homeroom?.organizationId}
          required
        />
        <AdminSelect
          label="Campus"
          name="campusId"
          options={data.campusOptions}
          defaultValue={homeroom?.campusId}
        />
        <AdminSelect
          includeEmpty={false}
          label="Academic year"
          name="academicYearId"
          options={data.academicYearOptions}
          defaultValue={homeroom?.academicYearId}
          required
        />
        <AdminSelect
          label="Grade level"
          name="gradeLevelId"
          options={data.gradeLevelOptions}
          defaultValue={homeroom?.gradeLevelId}
        />
        <AdminSelect
          label="Teacher"
          name="teacherId"
          options={data.userOptions}
          defaultValue={homeroom?.teacherId}
        />
        <Field
          label="Name"
          name="name"
          defaultValue={homeroom?.name}
          required
        />
        <div className="flex items-end">
          <SubmitButton />
        </div>
      </form>
    </FormCard>
  )
}
