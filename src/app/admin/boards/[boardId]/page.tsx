import { notFound } from "next/navigation"

import { deleteBoard, deactivateBoard } from "@/modules/boards/actions"
import { BoardDetailPage } from "@/modules/boards/board-detail"
import { BoardForm } from "@/modules/boards/board-form"
import { getBoardDetail } from "@/modules/boards/data"
import { getAcademicSetupOptions } from "@/modules/admin/data"
import { Button } from "@/components/ui/button"

export default async function AdminBoardDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ boardId: string }>
  searchParams: Promise<{ pinned?: string; q?: string; status?: string }>
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
      <details className="rounded-lg border bg-background p-4" open>
        <summary className="cursor-pointer font-medium">Board settings</summary>
        <div className="pt-4">
          <BoardForm
            board={detail.board}
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
            organizationOptions={admin.organizationOptions}
            submitLabel="Save board"
          />
          <div className="mt-4 flex flex-wrap gap-2">
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
