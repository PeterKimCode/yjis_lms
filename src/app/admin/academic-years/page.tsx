import { saveAcademicYear } from "@/modules/admin/actions"
import {
  ActiveBadge,
  AdminPageHeader,
  AdminSelect,
  DataTable,
  Field,
  FormCard,
  SubmitButton,
  TableCell,
  TableRow,
} from "@/modules/admin/components"
import { formatDate, getAcademicSetupOptions } from "@/modules/admin/data"

export default async function AcademicYearsPage() {
  const data = await getAcademicSetupOptions()

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Academic years"
        description="Create and edit school years for K-12, academy, or university terms."
      />
      <AcademicYearForm
        campusOptions={data.campusOptions}
        organizationOptions={data.organizationOptions}
      />
      <DataTable
        empty="No academic years yet."
        headers={["Name", "Dates", "Campus", "Status", "Edit"]}
        rows={data.academicYears.map((year) => (
          <TableRow key={year.id}>
            <TableCell className="font-medium">{year.name}</TableCell>
            <TableCell>
              {formatDate(year.startsAt)} - {formatDate(year.endsAt)}
            </TableCell>
            <TableCell>{year.campusId ?? "All campuses"}</TableCell>
            <TableCell>
              <ActiveBadge active={year.isActive} />
            </TableCell>
            <TableCell>
              <AcademicYearForm
                campusOptions={data.campusOptions}
                organizationOptions={data.organizationOptions}
                year={year}
              />
            </TableCell>
          </TableRow>
        ))}
      />
    </div>
  )
}

function AcademicYearForm({
  organizationOptions,
  campusOptions,
  year,
}: {
  organizationOptions: { id: string; label: string }[]
  campusOptions: { id: string; label: string }[]
  year?: {
    id: string
    organizationId: string
    campusId: string | null
    name: string
    startsAt: Date
    endsAt: Date
    isActive: boolean
  }
}) {
  return (
    <FormCard title={year ? "Edit academic year" : "Create academic year"}>
      <form action={saveAcademicYear} className="grid gap-3 md:grid-cols-4">
        <input name="id" type="hidden" value={year?.id ?? ""} />
        <AdminSelect
          includeEmpty={false}
          label="Organization"
          name="organizationId"
          options={organizationOptions}
          defaultValue={year?.organizationId}
          required
        />
        <AdminSelect
          label="Campus"
          name="campusId"
          options={campusOptions}
          defaultValue={year?.campusId}
        />
        <Field label="Name" name="name" defaultValue={year?.name} required />
        <Field
          label="Starts"
          name="startsAt"
          type="date"
          defaultValue={year ? formatDate(year.startsAt) : ""}
          required
        />
        <Field
          label="Ends"
          name="endsAt"
          type="date"
          defaultValue={year ? formatDate(year.endsAt) : ""}
          required
        />
        <label className="flex items-end gap-2 text-sm">
          <input
            name="isActive"
            type="checkbox"
            defaultChecked={year?.isActive ?? false}
          />
          Active
        </label>
        <div className="flex items-end">
          <SubmitButton />
        </div>
      </form>
    </FormCard>
  )
}
