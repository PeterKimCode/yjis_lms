import { getPrismaClient } from "@/lib/prisma"
import {
  ActiveBadge,
  AdminPageHeader,
  DataTable,
  TableCell,
  TableRow,
} from "@/modules/admin/components"
import { getAdminData } from "@/modules/admin/data"

export default async function UsersPage() {
  const admin = await getAdminData()
  const users = await getPrismaClient().user.findMany({
    where: {
      organizationId: { in: admin.organizations.map((org) => org.id) },
    },
    include: {
      organization: true,
      roleAssignments: {
        select: { role: true, campus: true },
      },
    },
    orderBy: { name: "asc" },
  })

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Users"
        description="School-managed users. Public registration is intentionally unavailable."
      />
      <DataTable
        empty="No users are available for your scope."
        headers={["Name", "Email", "Organization", "Roles", "Status"]}
        rows={users.map((user) => (
          <TableRow key={user.id}>
            <TableCell className="font-medium">{user.name}</TableCell>
            <TableCell>{user.email ?? "-"}</TableCell>
            <TableCell>{user.organization.name}</TableCell>
            <TableCell>
              {user.roleAssignments
                .map((assignment) =>
                  assignment.campus
                    ? `${assignment.role} (${assignment.campus.name})`
                    : assignment.role
                )
                .join(", ") || "-"}
            </TableCell>
            <TableCell>
              <ActiveBadge active={user.isActive} />
            </TableCell>
          </TableRow>
        ))}
      />
    </div>
  )
}
