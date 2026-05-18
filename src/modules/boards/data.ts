import "server-only"

import { getPrismaClient } from "@/lib/prisma"
import {
  boardKindLabel,
  getBoardSettings,
} from "@/modules/boards/constants"
import { getBoardAccess } from "@/modules/boards/permissions"

export async function getBoardDetail(boardId: string, q = "") {
  const access = await getBoardAccess(boardId)

  if (!access.canView || !access.board) {
    return null
  }

  const query = q.trim()
  const board = await getPrismaClient().board.findUnique({
    where: { id: boardId },
    include: {
      campus: true,
      classSection: {
        include: {
          campus: true,
          course: true,
          term: true,
        },
      },
      organization: true,
      posts: {
        where: {
          publishedAt: { not: null },
          ...(query
            ? {
                OR: [
                  { title: { contains: query, mode: "insensitive" } },
                  { body: { contains: query, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        include: {
          author: {
            include: {
              roleAssignments: true,
            },
          },
          comments: {
            include: {
              author: {
                include: {
                  roleAssignments: true,
                },
              },
            },
            orderBy: { createdAt: "asc" },
          },
          _count: {
            select: { comments: true },
          },
        },
        orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
      },
    },
  })

  if (!board) return null

  const settings = getBoardSettings(board.settings)

  return {
    ...access,
    board,
    settings,
    boardKindLabel: boardKindLabel(settings.boardKind),
  }
}
