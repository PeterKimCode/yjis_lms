import Link from "next/link"

import { getPrismaClient } from "@/lib/prisma"
import { getUserWhereForAdmin } from "@/modules/admin/access"
import {
  ActiveBadge,
  AdminPageHeader,
  DataTable,
  matchesSearch,
  SearchForm,
  TableCell,
  TableRow,
} from "@/modules/admin/components"
import { getAcademicSetupOptions } from "@/modules/admin/data"
import { UserForm } from "@/modules/admin/user-form"
import { Button } from "@/components/ui/button"

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const admin = await getAcademicSetupOptions()
  const q = (await searchParams).q?.trim() ?? ""
  const users = await getPrismaClient().user.findMany({
    where: getUserWhereForAdmin(admin.user),
    include: {
      organization: true,
      studentProfile: {
        include: {
          currentGradeLevel: true,
          homeroom: true,
        },
      },
      roleAssignments: {
        select: { id: true, role: true, organizationId: true, campusId: true, campus: true },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { name: "asc" },
  })
  const filteredUsers = users.filter((user) =>
    matchesSearch(q, [
      user.name,
      user.email,
      user.organization.name,
      user.roleAssignments.map((assignment) => assignment.role).join(" "),
      user.roleAssignments.map((assignment) => assignment.campus?.name).join(" "),
      user.studentProfile?.currentGradeLevel?.name,
      user.studentProfile?.homeroom?.name,
      user.studentProfile?.studentNumber,
    ])
  )

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Users"
        description="School-managed users. Public registration is intentionally unavailable."
      />
      <SearchForm q={q} placeholder="Search users, emails, roles..." />
      <UserForm
        campusOptions={admin.campusOptions}
        gradeLevelOptions={admin.gradeLevelOptions}
        homeroomOptions={admin.homeroomOptions}
        organizationOptions={admin.organizationOptions}
      />
      <DataTable
        empty="No users are available for your scope."
        headers={[
          "Name",
          "Email",
          "Organization",
          "Roles",
          "Student placement",
          "Status",
          "Edit",
        ]}
        rows={filteredUsers.map((user) => (
          <TableRow key={user.id}>
            <TableCell className="max-w-[220px] font-medium">
              <Link
                className="block truncate text-primary underline-offset-4 hover:underline"
                href={`/admin/users/${user.id}`}
                title={user.name}
              >
                {user.name}
              </Link>
            </TableCell>
            <TableCell className="max-w-[240px] truncate" title={user.email ?? "-"}>
              {user.email ?? "-"}
            </TableCell>
            <TableCell className="max-w-[220px] truncate" title={user.organization.name}>
              {user.organization.name}
            </TableCell>
            <TableCell className="max-w-[280px] truncate">
              <span
                title={
                  user.roleAssignments
                    .map((assignment) =>
                      assignment.campus
                        ? `${assignment.role} (${assignment.campus.name})`
                        : assignment.role
                    )
                    .join(", ") || "-"
                }
              >
                {user.roleAssignments
                  .map((assignment) =>
                    assignment.campus
                      ? `${assignment.role} (${assignment.campus.name})`
                      : assignment.role
                  )
                  .join(", ") || "-"}
              </span>
            </TableCell>
            <TableCell>
              {user.studentProfile ? (
                <div className="space-y-1 text-sm">
                  <div>
                    {user.studentProfile.currentGradeLevel?.name ?? "No grade"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {user.studentProfile.homeroom?.name ?? "No homeroom"}
                  </div>
                </div>
              ) : (
                "-"
              )}
            </TableCell>
            <TableCell>
              <ActiveBadge active={user.isActive} />
            </TableCell>
            <TableCell>
              <Button asChild size="sm" variant="outline">
                <Link href={`/admin/users/${user.id}`}>Edit</Link>
              </Button>
            </TableCell>
          </TableRow>
        ))}
        minWidth="min-w-[980px]"
      />
    </div>
  )
}
