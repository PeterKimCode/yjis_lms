import { deleteAdminEntity, saveAcademicYear } from "@/modules/admin/actions"
import {
  ActiveBadge,
  AdminPageHeader,
  AdminSelect,
  DataTable,
  DeleteStatusBanner,
  Field,
  FormCard,
  matchesSearch,
  SearchForm,
  SubmitButton,
  TableCell,
  TableRow,
} from "@/modules/admin/components"
import { getAcademicSetupOptions } from "@/modules/admin/data"
import { ConfirmDeleteForm } from "@/modules/admin/delete-button"

export default async function AcademicYearsPage({
  searchParams,
}: {
  searchParams: Promise<{
    deleted?: string
    deleteError?: string
    organizationId?: string
    q?: string
  }>
}) {
  const data = await getAcademicSetupOptions()
  const params = await searchParams
  const organizationId = params.organizationId?.trim() ?? ""
  const q = params.q?.trim() ?? ""
  const academicYears = data.academicYears
    .filter((year) => !organizationId || year.organizationId === organizationId)
    .filter((year) =>
      matchesSearch(q, [year.name, year.campus?.name, year.organization.name])
    )
  const organizationOptions = organizationId
    ? data.organizationOptions.filter((option) => option.id === organizationId)
    : data.organizationOptions
  const campusOptions = organizationId
    ? data.campusOptions.filter((option) => option.organizationId === organizationId)
    : data.campusOptions

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Academic years"
        description="Create and edit school years for K-12, academy, or university terms."
      />
      <DeleteStatusBanner deleted={params.deleted} deleteError={params.deleteError} />
      <SearchForm
        hiddenFields={{ organizationId }}
        q={q}
        placeholder="Search academic years..."
        resetHref={
          organizationId
            ? `/admin/academic-years?organizationId=${organizationId}`
            : "?"
        }
      />
      <AcademicYearForm
        campusOptions={campusOptions}
        organizationOptions={organizationOptions}
      />
      <DataTable
        empty="No academic years yet."
        headers={["Name", "Dates", "Campus", "Status", "Edit", "Delete"]}
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
                campusOptions={campusOptions}
                organizationOptions={organizationOptions}
                year={year}
              />
            </TableCell>
            <TableCell>
              <ConfirmDeleteForm
                action={deleteAdminEntity}
                entity="academicYear"
                id={year.id}
                message={`Delete academic year "${year.name}"? Related terms and classes may be removed or prevent deletion.`}
                returnPath="/admin/academic-years"
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
