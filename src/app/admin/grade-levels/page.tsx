import { saveGradeLevel } from "@/modules/admin/actions"
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

export default async function GradeLevelsPage() {
  const data = await getAcademicSetupOptions()

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Grade levels"
        description="Define K-12 grade levels or academy cohorts."
      />
      <GradeLevelForm data={data} />
      <DataTable
        empty="No grade levels yet."
        headers={["Name", "Code", "Sequence", "Academic Year", "Edit"]}
        rows={data.gradeLevels.map((gradeLevel) => (
          <TableRow key={gradeLevel.id}>
            <TableCell className="font-medium">{gradeLevel.name}</TableCell>
            <TableCell>{gradeLevel.code ?? "-"}</TableCell>
            <TableCell>{gradeLevel.sequence}</TableCell>
            <TableCell>
              {data.academicYears.find(
                (year) => year.id === gradeLevel.academicYearId
              )?.name ?? "-"}
            </TableCell>
            <TableCell>
              <GradeLevelForm data={data} gradeLevel={gradeLevel} />
            </TableCell>
          </TableRow>
        ))}
      />
    </div>
  )
}

function GradeLevelForm({
  data,
  gradeLevel,
}: {
  data: Awaited<ReturnType<typeof getAcademicSetupOptions>>
  gradeLevel?: {
    id: string
    organizationId: string
    campusId: string | null
    academicYearId: string | null
    name: string
    code: string | null
    sequence: number
  }
}) {
  return (
    <FormCard title={gradeLevel ? "Edit grade level" : "Create grade level"}>
      <form action={saveGradeLevel} className="grid gap-3 md:grid-cols-4">
        <input name="id" type="hidden" value={gradeLevel?.id ?? ""} />
        <AdminSelect
          includeEmpty={false}
          label="Organization"
          name="organizationId"
          options={data.organizationOptions}
          defaultValue={gradeLevel?.organizationId}
          required
        />
        <AdminSelect
          label="Campus"
          name="campusId"
          options={data.campusOptions}
          defaultValue={gradeLevel?.campusId}
        />
        <AdminSelect
          label="Academic year"
          name="academicYearId"
          options={data.academicYearOptions}
          defaultValue={gradeLevel?.academicYearId}
        />
        <Field
          label="Name"
          name="name"
          defaultValue={gradeLevel?.name}
          required
        />
        <Field label="Code" name="code" defaultValue={gradeLevel?.code} />
        <Field
          label="Sequence"
          name="sequence"
          type="number"
          defaultValue={gradeLevel?.sequence ?? 1}
          required
        />
        <div className="flex items-end">
          <SubmitButton />
        </div>
      </form>
    </FormCard>
  )
}
