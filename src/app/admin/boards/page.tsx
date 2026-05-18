import Link from "next/link"

import { Button } from "@/components/ui/button"
import { getPrismaClient } from "@/lib/prisma"
import {
  ActiveBadge,
  AdminPageHeader,
  DataTable,
  matchesSearch,
  TableCell,
  TableRow,
} from "@/modules/admin/components"
import { getScopedWhereForAdmin } from "@/modules/admin/access"
import { getAcademicSetupOptions } from "@/modules/admin/data"
import { BoardForm } from "@/modules/boards/board-form"
import {
  BOARD_KIND_OPTIONS,
  type BoardKind,
  boardKindLabel,
  getBoardSettings,
} from "@/modules/boards/constants"

export default async function AdminBoardsPage({
  searchParams,
}: {
  searchParams: Promise<{
    boardDeleted?: string
    boardType?: string
    campusId?: string
    organizationId?: string
    permission?: string
    q?: string
    scope?: string
    status?: string
  }>
}) {
  const params = await searchParams
  const q = params.q?.trim() ?? ""
  const admin = await getAcademicSetupOptions()
  const boards = await getPrismaClient().board.findMany({
    where: getScopedWhereForAdmin(admin.user),
    include: {
      campus: true,
      classSection: { include: { course: true } },
      organization: true,
      _count: { select: { posts: true } },
    },
    orderBy: [{ createdAt: "desc" }],
  })
  const filteredBoards = boards.filter((board) => {
    const settings = getBoardSettings(board.settings)
    const scope = board.classSectionId
      ? "class"
      : board.campusId
        ? "campus"
        : "organization"

    return (
      matchesSearch(q, [
        board.name,
        board.description,
        board.organization.name,
        board.campus?.name,
        board.classSection?.name,
        board.classSection?.course.title,
        boardKindLabel(settings.boardKind),
      ]) &&
      (!params.organizationId || board.organizationId === params.organizationId) &&
      (!params.campusId || board.campusId === params.campusId) &&
      (!params.scope || params.scope === "all" || scope === params.scope) &&
      (!params.boardType || settings.boardKind === params.boardType) &&
      (!params.status ||
        params.status === "all" ||
        (params.status === "active" ? board.isActive : !board.isActive)) &&
      (!params.permission ||
        params.permission === "all" ||
        (params.permission === "studentPosts" && settings.allowStudentPosts) ||
        (params.permission === "parentPosts" && settings.allowParentPosts) ||
        (params.permission === "comments" && settings.allowComments))
    )
  })

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Boards"
        description="Manage school announcements, class boards, Q&A, resources, and discussions."
      />
      {params.boardDeleted ? (
        <p className="rounded-md border bg-background p-3 text-sm text-muted-foreground">
          Board deleted.
        </p>
      ) : null}
      <BoardFilters admin={admin} params={params} q={q} />
      <details className="rounded-lg border bg-background p-4" open>
        <summary className="cursor-pointer font-medium">Create board</summary>
        <div className="pt-4">
          <BoardForm
            campusOptions={toCampusOptions(admin)}
            classSectionOptions={toClassSectionOptions(admin)}
            organizationOptions={admin.organizationOptions}
            submitLabel="Create board"
          />
        </div>
      </details>
      <DataTable
        empty="No boards are available for your scope."
        headers={[
          "Title",
          "Type",
          "Scope",
          "Posts",
          "Permissions",
          "Status",
          "Manage",
        ]}
        minWidth="min-w-[980px]"
        rows={filteredBoards.map((board) => {
          const settings = getBoardSettings(board.settings)
          return (
            <TableRow key={board.id}>
              <TableCell className="font-medium">{board.name}</TableCell>
              <TableCell>{boardKindLabel(settings.boardKind)}</TableCell>
              <TableCell>
                {board.classSection
                  ? `${board.classSection.name} (${board.classSection.course.title})`
                  : board.campus
                    ? `${board.campus.name} (${board.organization.name})`
                    : board.organization.name}
              </TableCell>
              <TableCell>{board._count.posts}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                Students: {settings.allowStudentPosts ? "post" : "read"} ·
                Parents: {settings.allowParentPosts ? "post" : "read"} ·
                Comments: {settings.allowComments ? "on" : "off"}
              </TableCell>
              <TableCell>
                <ActiveBadge active={board.isActive} />
              </TableCell>
              <TableCell>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/admin/boards/${board.id}`}>Manage</Link>
                </Button>
              </TableCell>
            </TableRow>
          )
        })}
      />
    </div>
  )
}

function BoardFilters({
  admin,
  params,
  q,
}: {
  admin: Awaited<ReturnType<typeof getAcademicSetupOptions>>
  params: {
    boardType?: string
    campusId?: string
    organizationId?: string
    permission?: string
    scope?: string
    status?: string
  }
  q: string
}) {
  // TODO: Promote this lightweight pattern into a shared AdminFilters component
  // for users, class sections, courses, and policies when those pages get richer
  // cross-scope filtering.
  return (
    <form className="rounded-lg border bg-background p-4" action="">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Search</span>
          <input
            className="h-9 rounded-md border bg-background px-3 text-sm"
            name="q"
            placeholder="Search boards..."
            defaultValue={q}
          />
        </label>
        <Select
          label="Organization"
          name="organizationId"
          defaultValue={params.organizationId}
          options={[
            ["", "All organizations"],
            ...admin.organizationOptions.map(
              (option) => [option.id, option.label] as const
            ),
          ]}
        />
        <Select
          label="Campus"
          name="campusId"
          defaultValue={params.campusId}
          options={[
            ["", "All campuses"],
            ...admin.campuses.map(
              (campus) =>
                [
                  campus.id,
                  `${campus.name} (${campus.organization.name})`,
                ] as const
            ),
          ]}
        />
        <Select
          label="Scope"
          name="scope"
          defaultValue={params.scope}
          options={[
            ["all", "All scopes"],
            ["organization", "Organization-wide"],
            ["campus", "Campus-wide"],
            ["class", "Class-specific"],
          ]}
        />
        <Select
          label="Board type"
          name="boardType"
          defaultValue={params.boardType}
          options={[
            ["", "All board types"],
            ...BOARD_KIND_OPTIONS.map(
              (kind) => [kind, boardKindLabel(kind as BoardKind)] as const
            ),
          ]}
        />
        <Select
          label="Status"
          name="status"
          defaultValue={params.status}
          options={[
            ["all", "All statuses"],
            ["active", "Active"],
            ["inactive", "Inactive"],
          ]}
        />
        <Select
          label="Permission"
          name="permission"
          defaultValue={params.permission}
          options={[
            ["all", "All permissions"],
            ["studentPosts", "Student posting allowed"],
            ["parentPosts", "Parent posting allowed"],
            ["comments", "Comments enabled"],
          ]}
        />
        <div className="flex items-end gap-2">
          <Button size="sm" type="submit" variant="outline">
            Apply filters
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href="/admin/boards">Reset filters</Link>
          </Button>
        </div>
      </div>
    </form>
  )
}

function Select({
  defaultValue,
  label,
  name,
  options,
}: {
  defaultValue?: string
  label: string
  name: string
  options: readonly (readonly [string, string])[]
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <select
        className="h-9 rounded-md border bg-background px-3 text-sm"
        name={name}
        defaultValue={defaultValue ?? options[0]?.[0] ?? ""}
      >
        {options.map(([value, labelText]) => (
          <option key={value} value={value}>
            {labelText}
          </option>
        ))}
      </select>
    </label>
  )
}

function toCampusOptions(admin: Awaited<ReturnType<typeof getAcademicSetupOptions>>) {
  return admin.campuses.map((campus) => ({
    id: campus.id,
    label: `${campus.name} (${campus.organization.name})`,
    organizationId: campus.organizationId,
  }))
}

function toClassSectionOptions(
  admin: Awaited<ReturnType<typeof getAcademicSetupOptions>>
) {
  return admin.classSections.map((section) => ({
    id: section.id,
    label: `${section.name} (${section.course.title})`,
    organizationId: section.organizationId,
    campusId: section.campusId,
  }))
}
