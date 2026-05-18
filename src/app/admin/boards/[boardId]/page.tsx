import { notFound } from "next/navigation"

import { deleteBoard, deactivateBoard } from "@/modules/boards/actions"
import { BoardDetailPage } from "@/modules/boards/board-detail"
import { BoardForm } from "@/modules/boards/board-form"
import { getBoardDetail } from "@/modules/boards/data"
import { getAcademicSetupOptions } from "@/modules/admin/data"
import { Button } from "@/components/ui/button"
import { getBoardSettings } from "@/modules/boards/constants"

export default async function AdminBoardDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ boardId: string }>
  searchParams: Promise<{
    boardDeleted?: string
    boardDeleteError?: string
    boardSaved?: string
    boardStatus?: string
    pinned?: string
    q?: string
    status?: string
  }>
}) {
  const { boardId } = await params
  const query = await searchParams
  const [admin, detail] = await Promise.all([
    getAcademicSetupOptions(),
    getBoardDetail(boardId, query),
  ])

  if (!detail || !detail.canManage) {
    notFound()
  }

  return (
    <div className="space-y-6">
      {query.boardSaved ? (
        <p className="rounded-md border bg-background p-3 text-sm text-muted-foreground">
          Board settings saved.
        </p>
      ) : null}
      {query.boardStatus === "deactivated" ? (
        <p className="rounded-md border bg-background p-3 text-sm text-muted-foreground">
          Board deactivated.
        </p>
      ) : null}
      {query.boardStatus === "alreadyInactive" ? (
        <p className="rounded-md border bg-background p-3 text-sm text-muted-foreground">
          Board is already inactive.
        </p>
      ) : null}
      {query.boardDeleteError === "hasPosts" ? (
        <p className="rounded-md border border-destructive/40 bg-background p-3 text-sm text-destructive">
          Cannot delete a board with posts. Deactivate it instead.
        </p>
      ) : null}
      <details className="rounded-lg border bg-background p-4" open>
        <summary className="cursor-pointer font-medium">Board settings</summary>
        <div className="pt-4">
          <BoardForm
            board={toBoardFormValue(detail.board)}
            campusOptions={admin.campuses.map((campus) => ({
              id: campus.id,
              label: `${campus.name} (${campus.organization.name})`,
              organizationId: campus.organizationId,
            }))}
            classSectionOptions={admin.classSections.map((section) => ({
              id: section.id,
              label: `${section.name} (${section.course.title})`,
              organizationId: section.organizationId,
              campusId: section.campusId,
            }))}
            formId="board-settings-form"
            hideSubmitButton
            organizationOptions={admin.organizationOptions}
            submitLabel="Save board"
          />
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button form="board-settings-form" size="sm" type="submit">
              Save board
            </Button>
            <form action={deactivateBoard}>
              <input name="boardId" type="hidden" value={detail.board.id} />
              <Button size="sm" type="submit" variant="outline">
                Deactivate board
              </Button>
            </form>
            <form action={deleteBoard}>
              <input name="boardId" type="hidden" value={detail.board.id} />
              <Button size="sm" type="submit" variant="destructive">
                Delete if empty
              </Button>
            </form>
          </div>
        </div>
      </details>
      <BoardDetailPage boardId={boardId} backHref="/admin/boards" query={query} />
    </div>
  )
}

function toBoardFormValue(board: NonNullable<Awaited<ReturnType<typeof getBoardDetail>>>["board"]) {
  const settings = getBoardSettings(board.settings)

  return {
    id: board.id,
    organizationId: board.organizationId,
    campusId: board.campusId,
    classSectionId: board.classSectionId,
    name: board.name,
    description: board.description,
    isActive: board.isActive,
    settings,
  }
}
