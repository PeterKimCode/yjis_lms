import { saveAcademicYear } from "@/modules/admin/actions"
import {
  ActiveBadge,
  AdminPageHeader,
  AdminSelect,
  DataTable,
  Field,
  FormCard,
  matchesSearch,
  SearchForm,
  SubmitButton,
  TableCell,
  TableRow,
} from "@/modules/admin/components"
import { getAcademicSetupOptions } from "@/modules/admin/data"

export default async function AcademicYearsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const data = await getAcademicSetupOptions()
  const q = (await searchParams).q?.trim() ?? ""
  const academicYears = data.academicYears.filter((year) =>
    matchesSearch(q, [year.name, year.campus?.name, year.organization.name])
  )

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Academic years"
        description="Create and edit school years for K-12, academy, or university terms."
      />
      <SearchForm q={q} placeholder="Search academic years..." />
      <AcademicYearForm
        campusOptions={data.campusOptions}
        organizationOptions={data.organizationOptions}
      />
      <DataTable
        empty="No academic years yet."
        headers={["Name", "Dates", "Campus", "Status", "Edit"]}
        rows={academicYears.map((year) => (
          <TableRow key={year.id}>
            <TableCell className="font-medium">{year.name}</TableCell>
            <TableCell>
              {formatYear(year.startsAt)} - {formatYear(year.endsAt)}
            </TableCell>
            <TableCell>
              {year.campus
                ? `${year.campus.name} (${year.organization.name})`
                : "Organization-wide"}
            </TableCell>
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
    campus?: { name: string } | null
    organization?: { name: string }
  }
}) {
  return (
    <FormCard title={year ? "Edit academic year" : "Create academic year"}>
      <form action={saveAcademicYear} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
          label="Start year"
          name="startsAt"
          type="number"
          defaultValue={year ? formatYear(year.startsAt) : ""}
          required
        />
        <Field
          label="End year"
          name="endsAt"
          type="number"
          defaultValue={year ? formatYear(year.endsAt) : ""}
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

function formatYear(value: Date) {
  return value.getUTCFullYear().toString()
}
