import { deleteAdminEntity, saveCampus } from "@/modules/admin/actions"
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
import { getAdminData } from "@/modules/admin/data"
import { ConfirmDeleteForm } from "@/modules/admin/delete-button"

export default async function CampusesPage({
  searchParams,
}: {
  searchParams: Promise<{
    createdWithPolicies?: string
    deleted?: string
    deleteError?: string
    policyInitFailed?: string
    q?: string
  }>
}) {
  const { campuses, organizationOptions } = await getAdminData()
  const params = await searchParams
  const q = params.q?.trim() ?? ""
  const filteredCampuses = campuses.filter((campus) =>
    matchesSearch(q, [
      campus.name,
      campus.code,
      campus.address,
      campus.phone,
      campus.organization.name,
    ])
  )

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Campuses"
        description="Campus records in your assigned organization or campus scope."
      />
      {params.createdWithPolicies ? (
        <p className="rounded-md border bg-background p-3 text-sm text-muted-foreground">
          Campus created with default policies.
        </p>
      ) : null}
      {params.policyInitFailed ? (
        <p className="rounded-md border border-destructive/40 bg-background p-3 text-sm text-destructive">
          Campus was not saved because default policy initialization failed. You
          can try again or initialize policies from Admin &gt; Policies.
        </p>
      ) : null}
      <DeleteStatusBanner deleted={params.deleted} deleteError={params.deleteError} />
      <SearchForm q={q} placeholder="Search campuses..." />
      <CampusForm organizationOptions={organizationOptions} />
      <DataTable
        empty="No campuses are available for your scope."
        headers={["Name", "Code", "Organization", "Address", "Status", "Edit", "Delete"]}
        rows={filteredCampuses.map((campus) => (
          <TableRow key={campus.id}>
            <TableCell className="font-medium">{campus.name}</TableCell>
            <TableCell>{campus.code ?? "-"}</TableCell>
            <TableCell>{campus.organization.name}</TableCell>
            <TableCell>{campus.address ?? "-"}</TableCell>
            <TableCell>
              <ActiveBadge active={campus.isActive} />
            </TableCell>
            <TableCell>
              <CampusForm campus={campus} organizationOptions={organizationOptions} />
            </TableCell>
            <TableCell>
              <ConfirmDeleteForm
                action={deleteAdminEntity}
                entity="campus"
                id={campus.id}
                message={`Delete campus "${campus.name}"? Related LMS records may prevent deletion.`}
                returnPath="/admin/campuses"
              />
            </TableCell>
          </TableRow>
        ))}
      />
    </div>
  )
}

function CampusForm({
  organizationOptions,
  campus,
}: {
  organizationOptions: { id: string; label: string }[]
  campus?: {
    id: string
    organizationId: string
    name: string
    code: string | null
    address: string | null
    phone: string | null
    isActive: boolean
  }
}) {
  return (
    <FormCard title={campus ? "Edit campus" : "Create campus"}>
      <form action={saveCampus} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <input name="id" type="hidden" value={campus?.id ?? ""} />
        <AdminSelect
          includeEmpty={false}
          label="Organization"
          name="organizationId"
          options={organizationOptions}
          defaultValue={campus?.organizationId}
          required
        />
        <Field label="Name" name="name" defaultValue={campus?.name} required />
        <Field label="Code" name="code" defaultValue={campus?.code} />
        <Field label="Address" name="address" defaultValue={campus?.address} />
        <Field label="Phone" name="phone" defaultValue={campus?.phone} />
        <label className="flex items-end gap-2 text-sm">
          <input
            name="isActive"
            type="checkbox"
            defaultChecked={campus?.isActive ?? true}
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
