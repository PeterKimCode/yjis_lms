import { BoardDetailPage } from "@/modules/boards/board-detail"

export default async function StudentBoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ boardId: string; classSectionId: string }>
  searchParams: Promise<{ pinned?: string; q?: string; status?: string }>
}) {
  const { boardId, classSectionId } = await params
  const query = await searchParams

  return (
    <BoardDetailPage
      backHref={`/student/classes/${classSectionId}`}
      boardId={boardId}
      expectedClassSectionId={classSectionId}
      query={query}
    />
  )
}
