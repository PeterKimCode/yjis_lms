import { UserRole } from "@prisma/client"

import { getPrismaClient } from "@/lib/prisma"
import { getUserWhereForAdmin } from "@/modules/admin/access"
import { saveUser } from "@/modules/admin/actions"
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

export default async function UsersPage() {
  const admin = await getAdminData()
  const users = await getPrismaClient().user.findMany({
    where: getUserWhereForAdmin(admin.user),
    include: {
      organization: true,
      roleAssignments: {
        select: { id: true, role: true, organizationId: true, campusId: true, campus: true },
        orderBy: { createdAt: "asc" },
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
      <UserForm
        campusOptions={admin.campusOptions}
        organizationOptions={admin.organizationOptions}
      />
      <DataTable
        empty="No users are available for your scope."
        headers={["Name", "Email", "Organization", "Roles", "Status", "Edit"]}
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
            <TableCell>
              <UserForm
                campusOptions={admin.campusOptions}
                organizationOptions={admin.organizationOptions}
                user={user}
              />
            </TableCell>
          </TableRow>
        ))}
      />
    </div>
  )
}

function UserForm({
  organizationOptions,
  campusOptions,
  user,
}: {
  organizationOptions: { id: string; label: string }[]
  campusOptions: { id: string; label: string }[]
  user?: {
    id: string
    organizationId: string
    name: string
    email: string | null
    isActive: boolean
    roleAssignments: {
      role: UserRole
      organizationId: string
      campusId: string | null
    }[]
  }
}) {
  const primaryRole = user?.roleAssignments[0]

  return (
    <FormCard title={user ? "Edit user" : "Create user"}>
      <form action={saveUser} className="grid gap-3 md:grid-cols-4">
        <input name="id" type="hidden" value={user?.id ?? ""} />
        <AdminSelect
          includeEmpty={false}
          label="Organization"
          name="organizationId"
          options={organizationOptions}
          defaultValue={primaryRole?.organizationId ?? user?.organizationId}
          required
        />
        <AdminSelect
          label="Campus"
          name="campusId"
          options={campusOptions}
          defaultValue={primaryRole?.campusId}
        />
        <Field label="Name" name="name" defaultValue={user?.name} required />
        <Field label="Email" name="email" type="email" defaultValue={user?.email} required />
        <Field
          label={user ? "New password" : "Password"}
          name="password"
          type="password"
          required={!user}
        />
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Role</span>
          <select
            className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
            name="role"
            defaultValue={primaryRole?.role ?? UserRole.STUDENT}
          >
            {Object.values(UserRole).map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-end gap-2 text-sm">
          <input
            name="isActive"
            type="checkbox"
            defaultChecked={user?.isActive ?? true}
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
