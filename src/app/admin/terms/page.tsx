import { deleteAdminEntity, saveTerm } from "@/modules/admin/actions"
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
import { formatDate, getAcademicSetupOptions } from "@/modules/admin/data"
import { ConfirmDeleteForm } from "@/modules/admin/delete-button"

export default async function TermsPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string; deleteError?: string; q?: string }>
}) {
  const data = await getAcademicSetupOptions()
  const params = await searchParams
  const q = params.q?.trim() ?? ""
  const terms = data.terms.filter((term) =>
    matchesSearch(q, [
      term.name,
      term.campus?.name,
      term.organization.name,
      data.academicYears.find((year) => year.id === term.academicYearId)?.name,
    ])
  )

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Terms"
        description="Create semester, trimester, quarter, or academy term windows."
      />
      <DeleteStatusBanner deleted={params.deleted} deleteError={params.deleteError} />
      <SearchForm q={q} placeholder="Search terms..." />
      <TermForm data={data} />
      <DataTable
        empty="No terms yet."
        headers={["Name", "Academic Year", "Dates", "Status", "Edit", "Delete"]}
        rows={terms.map((term) => (
          <TableRow key={term.id}>
            <TableCell className="font-medium">{term.name}</TableCell>
            <TableCell>
              {data.academicYears.find((year) => year.id === term.academicYearId)
                ?.name ?? "-"}
            </TableCell>
            <TableCell>
              {formatDate(term.startsAt)} - {formatDate(term.endsAt)}
            </TableCell>
            <TableCell>
              <ActiveBadge active={term.isActive} />
            </TableCell>
            <TableCell>
              <TermForm data={data} term={term} />
            </TableCell>
            <TableCell>
              <ConfirmDeleteForm
                action={deleteAdminEntity}
                entity="term"
                id={term.id}
                message={`Delete term "${term.name}"? Related class sections may prevent deletion.`}
                returnPath="/admin/terms"
              />
            </TableCell>
          </TableRow>
        ))}
      />
    </div>
  )
}

function TermForm({
  data,
  term,
}: {
  data: Awaited<ReturnType<typeof getAcademicSetupOptions>>
  term?: {
    id: string
    organizationId: string
    campusId: string | null
    academicYearId: string
    name: string
    startsAt: Date
    endsAt: Date
    sequence: number
    isActive: boolean
  }
}) {
  return (
    <FormCard title={term ? "Edit term" : "Create term"}>
      <form action={saveTerm} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <input name="id" type="hidden" value={term?.id ?? ""} />
        <AdminSelect
          includeEmpty={false}
          label="Organization"
          name="organizationId"
          options={data.organizationOptions}
          defaultValue={term?.organizationId}
          required
        />
        <AdminSelect
          label="Campus"
          name="campusId"
          options={data.campusOptions}
          defaultValue={term?.campusId}
        />
        <AdminSelect
          includeEmpty={false}
          label="Academic year"
          name="academicYearId"
          options={data.academicYearOptions}
          defaultValue={term?.academicYearId}
          required
        />
        <Field label="Name" name="name" defaultValue={term?.name} required />
        <Field
          label="Starts"
          name="startsAt"
          type="date"
          defaultValue={term ? formatDate(term.startsAt) : ""}
          required
        />
        <Field
          label="Ends"
          name="endsAt"
          type="date"
          defaultValue={term ? formatDate(term.endsAt) : ""}
          required
        />
        <Field
          label="Term order"
          name="sequence"
          type="number"
          defaultValue={term?.sequence ?? 1}
          required
        />
        <p className="text-xs text-muted-foreground xl:col-span-2">
          Term order controls sorting inside the academic year. Example: 1 =
          first semester, 2 = second semester.
        </p>
        <label className="flex items-end gap-2 text-sm">
          <input
            name="isActive"
            type="checkbox"
            defaultChecked={term?.isActive ?? false}
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
