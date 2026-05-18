import Link from "next/link"

import { Button } from "@/components/ui/button"
import { saveBoard } from "@/modules/boards/actions"
import {
  BOARD_KIND_OPTIONS,
  boardKindLabel,
  getBoardSettings,
} from "@/modules/boards/constants"
import {
  ActiveBadge,
  AdminPageHeader,
  AdminSelect,
  DataTable,
  Field,
  matchesSearch,
  SearchForm,
  SubmitButton,
  TableCell,
  TableRow,
} from "@/modules/admin/components"
import { getAcademicSetupOptions } from "@/modules/admin/data"
import { getPrismaClient } from "@/lib/prisma"
import { getScopedWhereForAdmin } from "@/modules/admin/access"

export default async function AdminBoardsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string }>
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
    return matchesSearch(q, [
      board.name,
      board.description,
      board.organization.name,
      board.campus?.name,
      board.classSection?.name,
      board.classSection?.course.title,
      boardKindLabel(settings.boardKind),
    ])
  })

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Boards"
        description="Manage school announcements, class boards, Q&A, resources, and discussions."
      />
      <SearchForm q={q} placeholder="Search boards..." />
      <details className="rounded-lg border bg-background p-4">
        <summary className="cursor-pointer font-medium">Create board</summary>
        <div className="pt-4">
          <BoardForm admin={admin} />
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

function BoardForm({
  admin,
}: {
  admin: Awaited<ReturnType<typeof getAcademicSetupOptions>>
}) {
  return (
    <form action={saveBoard} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <AdminSelect
        includeEmpty={false}
        label="Organization"
        name="organizationId"
        options={admin.organizationOptions}
        required
      />
      <AdminSelect
        label="Campus"
        name="campusId"
        options={admin.campusOptions}
      />
      <AdminSelect
        label="Class section"
        name="classSectionId"
        options={admin.classSections.map((section) => ({
          id: section.id,
          label: `${section.name} (${section.course.title})`,
        }))}
      />
      <label className="grid min-w-0 gap-1 text-sm">
        <span className="font-medium">Board type</span>
        <select
          className="h-8 min-w-0 rounded-lg border border-input bg-background px-2 text-sm"
          name="boardKind"
          defaultValue="SCHOOL_ANNOUNCEMENTS"
          required
        >
          {BOARD_KIND_OPTIONS.map((kind) => (
            <option key={kind} value={kind}>
              {boardKindLabel(kind)}
            </option>
          ))}
        </select>
      </label>
      <Field label="Title" name="name" required />
      <label className="grid min-w-0 gap-1 text-sm md:col-span-2">
        <span className="font-medium">Description</span>
        <textarea
          className="min-h-20 rounded-md border bg-background px-3 py-2 text-sm"
          name="description"
          placeholder="Describe how this board should be used."
        />
      </label>
      <label className="flex items-end gap-2 text-sm">
        <input name="allowStudentPosts" type="checkbox" />
        Allow student posts
      </label>
      <label className="flex items-end gap-2 text-sm">
        <input name="allowParentPosts" type="checkbox" />
        Allow parent posts
      </label>
      <label className="flex items-end gap-2 text-sm">
        <input name="allowComments" type="checkbox" defaultChecked />
        Allow comments
      </label>
      <label className="flex items-end gap-2 text-sm">
        <input name="isActive" type="checkbox" defaultChecked />
        Active
      </label>
      <div className="flex items-end">
        <SubmitButton label="Create board" />
      </div>
      <p className="text-xs text-muted-foreground md:col-span-2 xl:col-span-4">
        Attachments are intentionally deferred until file storage is stabilized.
      </p>
    </form>
  )
}
