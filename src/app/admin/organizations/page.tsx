import { InstitutionType } from "@prisma/client"

import { saveOrganization } from "@/modules/admin/actions"
import {
  ActiveBadge,
  AdminPageHeader,
  DataTable,
  FormCard,
  matchesSearch,
  SearchForm,
  SubmitButton,
  TableCell,
  TableRow,
} from "@/modules/admin/components"
import { getAdminData } from "@/modules/admin/data"

export default async function OrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { organizations } = await getAdminData()
  const q = (await searchParams).q?.trim() ?? ""
  const filteredOrganizations = organizations.filter((organization) =>
    matchesSearch(q, [
      organization.name,
      organization.slug,
      organization.institutionType,
    ])
  )

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Organizations"
        description="Tenant organizations available in your admin scope."
      />
      <SearchForm q={q} placeholder="Search organizations..." />
      <OrganizationForm />
      <DataTable
        empty="No organizations are available for your scope."
        headers={["Name", "Slug", "Type", "Status", "Edit"]}
        rows={filteredOrganizations.map((organization) => (
          <TableRow key={organization.id}>
            <TableCell className="font-medium">{organization.name}</TableCell>
            <TableCell>{organization.slug}</TableCell>
            <TableCell>{organization.institutionType}</TableCell>
            <TableCell>
              <ActiveBadge active={organization.isActive} />
            </TableCell>
            <TableCell>
              <OrganizationForm organization={organization} />
            </TableCell>
          </TableRow>
        ))}
      />
    </div>
  )
}

function OrganizationForm({
  organization,
}: {
  organization?: {
    id: string
    name: string
    institutionType: InstitutionType
    isActive: boolean
  }
}) {
  return (
    <FormCard title={organization ? "Edit organization" : "Create organization"}>
      <form action={saveOrganization} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <input name="id" type="hidden" value={organization?.id ?? ""} />
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Name</span>
          <input
            className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
            name="name"
            defaultValue={organization?.name ?? ""}
            required
          />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Type</span>
          <select
            className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
            name="institutionType"
            defaultValue={organization?.institutionType ?? InstitutionType.ONLINE_SCHOOL}
          >
            {Object.values(InstitutionType).map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-end gap-2 text-sm">
          <input
            name="isActive"
            type="checkbox"
            defaultChecked={organization?.isActive ?? true}
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
