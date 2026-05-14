import {
  ActiveBadge,
  AdminPageHeader,
  DataTable,
  TableCell,
  TableRow,
} from "@/modules/admin/components"
import { getAdminData } from "@/modules/admin/data"

export default async function OrganizationsPage() {
  const { organizations } = await getAdminData()

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Organizations"
        description="Tenant organizations available in your admin scope."
      />
      <DataTable
        empty="No organizations are available for your scope."
        headers={["Name", "Slug", "Type", "Status"]}
        rows={organizations.map((organization) => (
          <TableRow key={organization.id}>
            <TableCell className="font-medium">{organization.name}</TableCell>
            <TableCell>{organization.slug}</TableCell>
            <TableCell>{organization.institutionType}</TableCell>
            <TableCell>
              <ActiveBadge active={organization.isActive} />
            </TableCell>
          </TableRow>
        ))}
      />
    </div>
  )
}
