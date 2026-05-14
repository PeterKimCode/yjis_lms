import { saveCampus } from "@/modules/admin/actions"
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
import { getAdminData } from "@/modules/admin/data"

export default async function CampusesPage() {
  const { campuses, organizationOptions } = await getAdminData()

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Campuses"
        description="Campus records in your assigned organization or campus scope."
      />
      <CampusForm organizationOptions={organizationOptions} />
      <DataTable
        empty="No campuses are available for your scope."
        headers={["Name", "Code", "Organization", "Address", "Status", "Edit"]}
        rows={campuses.map((campus) => (
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
      <form action={saveCampus} className="grid gap-3 md:grid-cols-4">
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
