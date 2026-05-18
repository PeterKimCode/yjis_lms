import { BoardDetailPage } from "@/modules/boards/board-detail"

export default async function StudentBoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ boardId: string; classSectionId: string }>
  searchParams: Promise<{ q?: string }>
}) {
  const { boardId, classSectionId } = await params
  const q = (await searchParams).q ?? ""

  return (
    <BoardDetailPage
      backHref={`/student/classes/${classSectionId}`}
      boardId={boardId}
      q={q}
    />
  )
}
