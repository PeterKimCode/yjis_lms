import Link from "next/link"
import { UserDeletionRequestStatus, UserRole } from "@prisma/client"

import { Button } from "@/components/ui/button"
import { getPrismaClient } from "@/lib/prisma"
import {
  deleteAdminEntity,
  requestUserDeletion,
  reviewUserDeletionRequest,
} from "@/modules/admin/actions"
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
    deleteRequested?: string
    deleteError?: string
    dir?: string
    organizationId?: string
    q?: string
    requestError?: string
    reviewed?: string
    reviewError?: string
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
  const canManageAdminRoles = hasSuperAdminRole(admin.user.roleAssignments)
  const isSchoolAdminOnly =
    admin.user.roleAssignments.some(
      (assignment) => assignment.role === UserRole.SCHOOL_ADMIN
    ) && !canManageAdminRoles
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
  const pendingDeletionRequests = await getPrismaClient().userDeletionRequest.findMany({
    where: {
      status: UserDeletionRequestStatus.PENDING,
      ...(canManageAdminRoles ? {} : { requestedById: admin.user.id }),
      ...(users.length
        ? { targetUserId: { in: users.map((user) => user.id) } }
        : { targetUserId: "__none__" }),
    },
    include: {
      organization: { select: { name: true } },
      requestedBy: { select: { email: true, name: true } },
      targetUser: { select: { id: true, email: true, name: true } },
    },
    orderBy: { requestedAt: "desc" },
  })
  const pendingDeletionByUserId = new Map(
    pendingDeletionRequests
      .filter((request) => request.targetUserId)
      .map((request) => [request.targetUserId as string, request])
  )

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
      <UserDeletionStatusBanners params={params} />
      {canManageAdminRoles ? (
        <PendingUserDeletionRequests requests={pendingDeletionRequests} />
      ) : null}
      {isSchoolAdminOnly ? (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
          School admins can create instructor, parent, and student accounts in
          their scope. Admin accounts and user deletion require super admin
          approval.
        </div>
      ) : null}
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
              {canManageAdminRoles ? (
                <ConfirmDeleteForm
                  action={deleteAdminEntity}
                  entity="user"
                  id={user.id}
                  message={`Delete user "${user.name}"? This cannot be undone if no related records block deletion.`}
                  returnPath="/admin/users"
                />
              ) : pendingDeletionByUserId.has(user.id) ? (
                <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
                  Delete requested
                </span>
              ) : (
                <ConfirmDeleteForm
                  action={requestUserDeletion}
                  entity="user"
                  id={user.id}
                  label="Request delete"
                  message={`Request super admin approval to delete "${user.name}"? The user will not be deleted until a super admin approves.`}
                  returnPath="/admin/users"
                  warning="This sends an approval request only. A super admin must approve before the user is deleted."
                />
              )}
            </TableCell>
          </TableRow>
        ))}
        minWidth="min-w-[980px]"
      />
    </div>
  )
}

function UserDeletionStatusBanners({
  params,
}: {
  params: {
    deleteRequested?: string
    requestError?: string
    reviewed?: string
    reviewError?: string
  }
}) {
  return (
    <div className="space-y-2">
      {params.deleteRequested ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          User deletion request sent to super admins for approval.
        </div>
      ) : null}
      {params.requestError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Could not request user deletion. Check your scope or try again.
        </div>
      ) : null}
      {params.reviewed === "approved" ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
          User deletion request approved and the user was deleted.
        </div>
      ) : null}
      {params.reviewed === "rejected" ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
          User deletion request rejected.
        </div>
      ) : null}
      {params.reviewError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Could not review the user deletion request.
        </div>
      ) : null}
    </div>
  )
}

function PendingUserDeletionRequests({
  requests,
}: {
  requests: Array<{
    id: string
    organization: { name: string }
    requestedAt: Date
    requestedBy: { email: string | null; name: string } | null
    targetUser: { id: string; email: string | null; name: string } | null
    targetUserLoginId: string | null
    targetUserName: string
  }>
}) {
  if (!requests.length) return null

  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
      <div className="mb-3">
        <h2 className="font-semibold text-amber-950">Pending user deletion requests</h2>
        <p className="text-sm text-amber-800">
          Review requests from school admins before any user is deleted.
        </p>
      </div>
      <div className="grid gap-2">
        {requests.map((request) => (
          <div
            className="flex flex-col gap-3 rounded-lg border bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between"
            key={request.id}
          >
            <div className="min-w-0">
              <p className="font-medium">
                {request.targetUser?.name ?? request.targetUserName}
              </p>
              <p className="text-sm text-muted-foreground">
                {request.targetUser?.email ?? request.targetUserLoginId ?? "-"} ·{" "}
                {request.organization.name}
              </p>
              <p className="text-xs text-muted-foreground">
                Requested by {request.requestedBy?.name ?? "Unknown admin"} on{" "}
                {request.requestedAt.toLocaleString()}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <form action={reviewUserDeletionRequest}>
                <input name="requestId" type="hidden" value={request.id} />
                <input name="decision" type="hidden" value="approve" />
                <input name="returnPath" type="hidden" value="/admin/users" />
                <Button size="sm" type="submit" variant="destructive">
                  Approve delete
                </Button>
              </form>
              <form action={reviewUserDeletionRequest}>
                <input name="requestId" type="hidden" value={request.id} />
                <input name="decision" type="hidden" value="reject" />
                <input name="returnPath" type="hidden" value="/admin/users" />
                <Button size="sm" type="submit" variant="outline">
                  Reject
                </Button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </section>
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
        {sort === value ? (dir === "asc" ? "ASC" : "DESC") : "Sort"}
      </span>
    </Link>
  )
}

