import { BoardDetailPage } from "@/modules/boards/board-detail"

export default async function ParentBoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ boardId: string; classSectionId: string; studentId: string }>
  searchParams: Promise<{ page?: string; pinned?: string; q?: string; status?: string }>
}) {
  const { boardId, classSectionId, studentId } = await params
  const query = await searchParams

  return (
    <BoardDetailPage
      backHref={`/parent/students/${studentId}`}
      boardId={boardId}
      expectedClassSectionId={classSectionId}
      query={query}
    />
  )
}
