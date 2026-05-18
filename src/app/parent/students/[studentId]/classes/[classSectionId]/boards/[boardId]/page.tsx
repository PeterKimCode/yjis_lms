import { BoardDetailPage } from "@/modules/boards/board-detail"

export default async function ParentBoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ boardId: string; classSectionId: string; studentId: string }>
  searchParams: Promise<{ pinned?: string; q?: string; status?: string }>
}) {
  const { boardId, studentId } = await params
  const query = await searchParams

  return (
    <BoardDetailPage
      backHref={`/parent/students/${studentId}`}
      boardId={boardId}
      query={query}
    />
  )
}
