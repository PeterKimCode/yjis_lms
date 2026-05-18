import "server-only"

import { getPrismaClient } from "@/lib/prisma"
import {
  boardKindLabel,
  getBoardSettings,
} from "@/modules/boards/constants"
import { getBoardAccess } from "@/modules/boards/permissions"

export async function getBoardDetail(
  boardId: string,
  query: string | { pinned?: string; q?: string; status?: string } = ""
) {
  const access = await getBoardAccess(boardId)

  if (!access.canView || !access.board) {
    return null
  }

  const q = typeof query === "string" ? query : query.q ?? ""
  const status = typeof query === "string" ? "published" : query.status ?? "published"
  const pinned = typeof query === "string" ? "all" : query.pinned ?? "all"
  const search = q.trim()
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
          ...(access.canManage
            ? status === "unpublished"
              ? { publishedAt: null }
              : status === "all"
                ? {}
                : { publishedAt: { not: null } }
            : { publishedAt: { not: null } }),
          ...(pinned === "pinned"
            ? { isPinned: true }
            : pinned === "normal"
              ? { isPinned: false }
              : {}),
          ...(search
            ? {
                OR: [
                  { title: { contains: search, mode: "insensitive" } },
                  { body: { contains: search, mode: "insensitive" } },
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
          attachments: {
            include: {
              fileAsset: true,
            },
            orderBy: { createdAt: "asc" },
          },
          comments: {
            include: {
              author: {
                include: {
                  roleAssignments: true,
                },
              },
              attachments: {
                include: {
                  fileAsset: true,
                },
                orderBy: { createdAt: "asc" },
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
