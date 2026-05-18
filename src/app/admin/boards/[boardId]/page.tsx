import { notFound } from "next/navigation"

import { saveBoard } from "@/modules/boards/actions"
import { BoardDetailPage } from "@/modules/boards/board-detail"
import {
  BOARD_KIND_OPTIONS,
  boardKindLabel,
  getBoardSettings,
} from "@/modules/boards/constants"
import { getBoardDetail } from "@/modules/boards/data"
import {
  AdminSelect,
  Field,
  SubmitButton,
} from "@/modules/admin/components"
import { getAcademicSetupOptions } from "@/modules/admin/data"

export default async function AdminBoardDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ boardId: string }>
  searchParams: Promise<{ q?: string }>
}) {
  const { boardId } = await params
  const q = (await searchParams).q ?? ""
  const [admin, detail] = await Promise.all([
    getAcademicSetupOptions(),
    getBoardDetail(boardId, q),
  ])

  if (!detail || !detail.canManage) {
    notFound()
  }

  const settings = getBoardSettings(detail.board.settings)

  return (
    <div className="space-y-6">
      <details className="rounded-lg border bg-background p-4">
        <summary className="cursor-pointer font-medium">Board settings</summary>
        <form
          action={saveBoard}
          className="grid gap-3 pt-4 md:grid-cols-2 xl:grid-cols-4"
        >
          <input name="id" type="hidden" value={detail.board.id} />
          <AdminSelect
            includeEmpty={false}
            label="Organization"
            name="organizationId"
            options={admin.organizationOptions}
            defaultValue={detail.board.organizationId}
            required
          />
          <AdminSelect
            label="Campus"
            name="campusId"
            options={admin.campusOptions}
            defaultValue={detail.board.campusId}
          />
          <AdminSelect
            label="Class section"
            name="classSectionId"
            options={admin.classSections.map((section) => ({
              id: section.id,
              label: `${section.name} (${section.course.title})`,
            }))}
            defaultValue={detail.board.classSectionId}
          />
          <label className="grid min-w-0 gap-1 text-sm">
            <span className="font-medium">Board type</span>
            <select
              className="h-8 min-w-0 rounded-lg border border-input bg-background px-2 text-sm"
              name="boardKind"
              defaultValue={settings.boardKind}
              required
            >
              {BOARD_KIND_OPTIONS.map((kind) => (
                <option key={kind} value={kind}>
                  {boardKindLabel(kind)}
                </option>
              ))}
            </select>
          </label>
          <Field
            label="Title"
            name="name"
            defaultValue={detail.board.name}
            required
          />
          <label className="grid min-w-0 gap-1 text-sm md:col-span-2">
            <span className="font-medium">Description</span>
            <textarea
              className="min-h-20 rounded-md border bg-background px-3 py-2 text-sm"
              name="description"
              defaultValue={detail.board.description ?? ""}
            />
          </label>
          <label className="flex items-end gap-2 text-sm">
            <input
              name="allowStudentPosts"
              type="checkbox"
              defaultChecked={settings.allowStudentPosts}
            />
            Allow student posts
          </label>
          <label className="flex items-end gap-2 text-sm">
            <input
              name="allowParentPosts"
              type="checkbox"
              defaultChecked={settings.allowParentPosts}
            />
            Allow parent posts
          </label>
          <label className="flex items-end gap-2 text-sm">
            <input
              name="allowComments"
              type="checkbox"
              defaultChecked={settings.allowComments}
            />
            Allow comments
          </label>
          <label className="flex items-end gap-2 text-sm">
            <input
              name="isActive"
              type="checkbox"
              defaultChecked={detail.board.isActive}
            />
            Active
          </label>
          <div className="flex items-end">
            <SubmitButton />
          </div>
        </form>
      </details>
      <BoardDetailPage boardId={boardId} backHref="/admin/boards" q={q} />
    </div>
  )
}
