import {
  ActiveBadge,
  AdminPageHeader,
  DataTable,
  TableCell,
  TableRow,
} from "@/modules/admin/components"
import { getAdminData } from "@/modules/admin/data"

export default async function CampusesPage() {
  const { campuses } = await getAdminData()

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Campuses"
        description="Campus records in your assigned organization or campus scope."
      />
      <DataTable
        empty="No campuses are available for your scope."
        headers={["Name", "Code", "Organization", "Phone", "Status"]}
        rows={campuses.map((campus) => (
          <TableRow key={campus.id}>
            <TableCell className="font-medium">{campus.name}</TableCell>
            <TableCell>{campus.code ?? "-"}</TableCell>
            <TableCell>{campus.organization.name}</TableCell>
            <TableCell>{campus.phone ?? "-"}</TableCell>
            <TableCell>
              <ActiveBadge active={campus.isActive} />
            </TableCell>
          </TableRow>
        ))}
      />
    </div>
  )
}
