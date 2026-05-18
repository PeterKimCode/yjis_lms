import { BoardDetailPage } from "@/modules/boards/board-detail"

export default async function ParentBoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ boardId: string; classSectionId: string; studentId: string }>
  searchParams: Promise<{ q?: string }>
}) {
  const { boardId, studentId } = await params
  const q = (await searchParams).q ?? ""

  return (
    <BoardDetailPage
      backHref={`/parent/students/${studentId}`}
      boardId={boardId}
      q={q}
    />
  )
}
