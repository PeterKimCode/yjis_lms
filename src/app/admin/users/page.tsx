import Link from "next/link"
import { UserRole } from "@prisma/client"

import { Button } from "@/components/ui/button"
import { getPrismaClient } from "@/lib/prisma"
import { deleteAdminEntity } from "@/modules/admin/actions"
import { getUserWhereForAdmin } from "@/modules/admin/access"
import {
  ActiveBadge,
  AdminPageHeader,
  DataTable,
  DeleteStatusBanner,
  matchesSearch,
  TableCell,
  TableRow,
} from "@/modules/admin/components"
import { getAcademicSetupOptions } from "@/modules/admin/data"
import { ConfirmDeleteForm } from "@/modules/admin/delete-button"
import { getSelectableUserRoles } from "@/modules/admin/role-options"
import { hasSuperAdminRole } from "@/modules/admin/scope-rules"
import { UserForm } from "@/modules/admin/user-form"

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{
    deleted?: string
    deleteError?: string
    dir?: string
    organizationId?: string
    q?: string
    role?: string
    sort?: string
    status?: string
  }>
}) {
  const admin = await getAcademicSetupOptions()
  const params = await searchParams
  const q = params.q?.trim() ?? ""
  const organizationId = params.organizationId?.trim() ?? ""
  const role = params.role?.trim() ?? ""
  const status = params.status?.trim() ?? ""
  const sort = getUserSort(params.sort)
  const dir = params.dir === "desc" ? "desc" : "asc"
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
  const filteredUsers = users
    .filter((user) =>
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
    .filter((user) => !organizationId || user.organizationId === organizationId)
    .filter(
      (user) =>
        !role ||
        user.roleAssignments.some((assignment) => assignment.role === role)
    )
    .filter((user) => {
      if (status === "active") return user.isActive
      if (status === "inactive") return !user.isActive
      return true
    })
    .sort((a, b) => compareUsers(a, b, sort, dir))
  const canManageAdminRoles = hasSuperAdminRole(admin.user.roleAssignments)

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Users"
        description="School-managed users. Public registration is intentionally unavailable."
      />
      <UserFilters
        dir={dir}
        organizationId={organizationId}
        organizationOptions={admin.organizationOptions}
        q={q}
        role={role}
        roleOptions={getSelectableUserRoles({ canManageAdminRoles })}
        sort={sort}
        status={status}
        resultSummary={`${filteredUsers.length} of ${users.length} users shown`}
      />
      <DeleteStatusBanner deleted={params.deleted} deleteError={params.deleteError} />
      <UserForm
        canManageAdminRoles={canManageAdminRoles}
        campusOptions={admin.campusOptions}
        gradeLevelOptions={admin.gradeLevelOptions}
        homeroomOptions={admin.homeroomOptions}
        organizationOptions={admin.organizationOptions}
      />
      <DataTable
        empty="No users are available for your scope."
        headers={[
          <SortHeader
            dir={dir}
            filters={{ organizationId, q, role, status }}
            key="name"
            label="Name"
            sort={sort}
            value="name"
          />,
          <SortHeader
            dir={dir}
            filters={{ organizationId, q, role, status }}
            key="email"
            label="Email"
            sort={sort}
            value="email"
          />,
          <SortHeader
            dir={dir}
            filters={{ organizationId, q, role, status }}
            key="organization"
            label="Organization"
            sort={sort}
            value="organization"
          />,
          <SortHeader
            dir={dir}
            filters={{ organizationId, q, role, status }}
            key="role"
            label="Roles"
            sort={sort}
            value="role"
          />,
          "Student placement",
          <SortHeader
            dir={dir}
            filters={{ organizationId, q, role, status }}
            key="status"
            label="Status"
            sort={sort}
            value="status"
          />,
          "Edit",
          "Delete",
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
            <TableCell>
              <ConfirmDeleteForm
                action={deleteAdminEntity}
                entity="user"
                id={user.id}
                message={`Delete user "${user.name}"? This cannot be undone if no related records block deletion.`}
                returnPath="/admin/users"
              />
            </TableCell>
          </TableRow>
        ))}
        minWidth="min-w-[980px]"
      />
    </div>
  )
}

type UserRow = {
  email: string | null
  isActive: boolean
  name: string
  organization: { name: string }
  roleAssignments: { role: UserRole }[]
}

type UserSort = "email" | "name" | "organization" | "role" | "status"

function getUserSort(value: string | undefined): UserSort {
  if (
    value === "email" ||
    value === "organization" ||
    value === "role" ||
    value === "status"
  ) {
    return value
  }
  return "name"
}

function compareUsers<T extends UserRow>(
  a: T,
  b: T,
  sort: UserSort,
  dir: "asc" | "desc"
) {
  const direction = dir === "asc" ? 1 : -1
  const first = getSortValue(a, sort)
  const second = getSortValue(b, sort)
  return first.localeCompare(second, undefined, { sensitivity: "base" }) * direction
}

function getSortValue(user: UserRow, sort: UserSort) {
  if (sort === "email") return user.email ?? ""
  if (sort === "organization") return user.organization.name
  if (sort === "role") {
    return user.roleAssignments.map((assignment) => assignment.role).join(", ")
  }
  if (sort === "status") return user.isActive ? "active" : "inactive"
  return user.name
}

function UserFilters({
  dir,
  organizationId,
  organizationOptions,
  q,
  resultSummary,
  role,
  roleOptions,
  sort,
  status,
}: {
  dir: "asc" | "desc"
  organizationId: string
  organizationOptions: { id: string; label: string }[]
  q: string
  resultSummary: string
  role: string
  roleOptions: readonly UserRole[]
  sort: UserSort
  status: string
}) {
  return (
    <form action="/admin/users#user-results" className="lms-soft-panel rounded-lg p-3">
      <input name="sort" type="hidden" value={sort} />
      <input name="dir" type="hidden" value={dir} />
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
        <input
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
          defaultValue={q}
          name="q"
          placeholder="Search name, login ID, role..."
        />
        <select
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
          defaultValue={organizationId}
          name="organizationId"
        >
          <option value="">All organizations</option>
          {organizationOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
        <select
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
          defaultValue={role}
          name="role"
        >
          <option value="">All roles</option>
          {roleOptions.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <select
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
          defaultValue={status}
          name="status"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <div className="flex gap-2">
          <Button type="submit" variant="outline">
            Search
          </Button>
          <Button asChild type="button" variant="ghost">
            <Link href="/admin/users#user-results">Reset</Link>
          </Button>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{resultSummary}</p>
      <div id="user-results" />
    </form>
  )
}

function SortHeader({
  dir,
  filters,
  label,
  sort,
  value,
}: {
  dir: "asc" | "desc"
  filters: {
    organizationId: string
    q: string
    role: string
    status: string
  }
  label: string
  sort: UserSort
  value: UserSort
}) {
  const nextDir = sort === value && dir === "asc" ? "desc" : "asc"
  const search = new URLSearchParams()

  for (const [key, filterValue] of Object.entries(filters)) {
    if (filterValue) search.set(key, filterValue)
  }
  search.set("sort", value)
  search.set("dir", nextDir)

  return (
    <Link
      className="inline-flex items-center gap-1 font-semibold text-foreground hover:text-primary"
      href={`/admin/users?${search.toString()}#user-results`}
    >
      {label}
      <span className="text-xs text-muted-foreground">
        {sort === value ? (dir === "asc" ? "↑" : "↓") : "↕"}
      </span>
    </Link>
  )
}
