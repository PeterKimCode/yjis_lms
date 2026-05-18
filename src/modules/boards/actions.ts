"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { getPrismaClient } from "@/lib/prisma"
import { assertAdminScope } from "@/modules/admin/access"
import { canManageClassSection, requireAuth } from "@/modules/auth/permissions"
import {
  BOARD_KIND_OPTIONS,
  getBoardScopeTypeForKind,
  getBoardTypeForKind,
} from "@/modules/boards/constants"
import { getBoardAccess } from "@/modules/boards/permissions"

const optionalString = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() : ""),
  z.string().transform((value) => (value.length ? value : null))
)
const requiredString = z.string().trim().min(1)
const checkboxBoolean = z
  .union([z.literal("on"), z.null()])
  .transform((value) => value === "on")

const boardSchema = z.object({
  id: optionalString,
  organizationId: requiredString,
  campusId: optionalString,
  classSectionId: optionalString,
  boardKind: z.enum(BOARD_KIND_OPTIONS),
  name: requiredString.max(200),
  description: optionalString,
  allowStudentPosts: checkboxBoolean,
  allowParentPosts: checkboxBoolean,
  allowComments: checkboxBoolean,
  isActive: checkboxBoolean,
})

export async function saveBoard(formData: FormData) {
  const parsed = boardSchema.safeParse({
    ...Object.fromEntries(formData.entries()),
    allowStudentPosts: formData.get("allowStudentPosts"),
    allowParentPosts: formData.get("allowParentPosts"),
    allowComments: formData.get("allowComments"),
    isActive: formData.get("isActive"),
  })

  if (!parsed.success) {
    throw new Error("Board title, type, and scope are required.")
  }

  const data = parsed.data
  const prisma = getPrismaClient()
  let scope = {
    organizationId: data.organizationId,
    campusId: data.campusId,
  }

  if (data.classSectionId) {
    const classSection = await prisma.classSection.findUniqueOrThrow({
      where: { id: data.classSectionId },
      select: { organizationId: true, campusId: true },
    })
    scope = {
      organizationId: classSection.organizationId,
      campusId: classSection.campusId,
    }
  }

  await assertAdminScope(scope)

  await prisma.board.upsert({
    where: { id: data.id ?? "__new_board__" },
    update: {
      ...scope,
      classSectionId: data.classSectionId,
      description: data.description,
      isActive: data.isActive,
      name: data.name,
      scopeType: getBoardScopeTypeForKind(
        data.boardKind,
        Boolean(data.classSectionId)
      ),
      settings: {
        boardKind: data.boardKind,
        allowStudentPosts: data.allowStudentPosts,
        allowParentPosts: data.allowParentPosts,
        allowComments: data.allowComments,
      },
      type: getBoardTypeForKind(data.boardKind),
    },
    create: {
      ...scope,
      classSectionId: data.classSectionId,
      description: data.description,
      isActive: data.isActive,
      name: data.name,
      scopeType: getBoardScopeTypeForKind(
        data.boardKind,
        Boolean(data.classSectionId)
      ),
      settings: {
        boardKind: data.boardKind,
        allowStudentPosts: data.allowStudentPosts,
        allowParentPosts: data.allowParentPosts,
        allowComments: data.allowComments,
      },
      type: getBoardTypeForKind(data.boardKind),
    },
  })

  revalidatePath("/admin/boards")
  revalidatePath("/admin")
}

const classBoardSchema = z.object({
  classSectionId: requiredString,
  boardKind: z.enum(BOARD_KIND_OPTIONS),
  name: requiredString.max(200),
  description: optionalString,
  allowStudentPosts: checkboxBoolean,
  allowParentPosts: checkboxBoolean,
  allowComments: checkboxBoolean,
})

export async function createClassBoard(formData: FormData) {
  const parsed = classBoardSchema.safeParse({
    ...Object.fromEntries(formData.entries()),
    allowStudentPosts: formData.get("allowStudentPosts"),
    allowParentPosts: formData.get("allowParentPosts"),
    allowComments: formData.get("allowComments"),
  })

  if (!parsed.success) {
    throw new Error("Class board title and type are required.")
  }

  const data = parsed.data
  const accessUser = await requireAuth()
  if (!(await canManageClassSection(accessUser.id, data.classSectionId))) {
    throw new Error("You do not have permission to manage this class board.")
  }

  const prisma = getPrismaClient()
  const classSection = await prisma.classSection.findUniqueOrThrow({
    where: { id: data.classSectionId },
    select: { organizationId: true, campusId: true },
  })
  await prisma.board.create({
    data: {
      organizationId: classSection.organizationId,
      campusId: classSection.campusId,
      classSectionId: data.classSectionId,
      description: data.description,
      isActive: true,
      name: data.name,
      scopeType: getBoardScopeTypeForKind(data.boardKind, true),
      settings: {
        boardKind: data.boardKind,
        allowStudentPosts: data.allowStudentPosts,
        allowParentPosts: data.allowParentPosts,
        allowComments: data.allowComments,
      },
      type: getBoardTypeForKind(data.boardKind),
    },
  })

  revalidatePath(`/instructor/classes/${data.classSectionId}`)
}

const postSchema = z.object({
  boardId: requiredString,
  title: requiredString.max(200),
  body: requiredString.max(10000),
  isPinned: checkboxBoolean,
})

export async function createPost(formData: FormData) {
  const parsed = postSchema.safeParse({
    ...Object.fromEntries(formData.entries()),
    isPinned: formData.get("isPinned"),
  })

  if (!parsed.success) {
    throw new Error("Post title and content are required.")
  }

  const data = parsed.data
  const access = await getBoardAccess(data.boardId)

  if (!access.user || !access.board || !access.canPost) {
    throw new Error("You do not have permission to post on this board.")
  }

  await getPrismaClient().post.create({
    data: {
      organizationId: access.board.organizationId,
      authorId: access.user.id,
      boardId: data.boardId,
      body: data.body,
      isPinned: access.canManage ? data.isPinned : false,
      publishedAt: new Date(),
      title: data.title,
    },
  })

  revalidateBoard(access.board.id, access.board.classSectionId)
}

const commentSchema = z.object({
  postId: requiredString,
  body: requiredString.max(3000),
})

export async function createComment(formData: FormData) {
  const parsed = commentSchema.safeParse(Object.fromEntries(formData.entries()))

  if (!parsed.success) {
    throw new Error("Comment content is required.")
  }

  const data = parsed.data
  const post = await getPrismaClient().post.findUniqueOrThrow({
    where: { id: data.postId },
    include: { board: true },
  })
  const access = await getBoardAccess(post.boardId)

  if (!access.user || !access.canComment) {
    throw new Error("Comments are not allowed on this board.")
  }

  await getPrismaClient().comment.create({
    data: {
      organizationId: post.organizationId,
      authorId: access.user.id,
      body: data.body,
      postId: post.id,
    },
  })

  revalidateBoard(post.boardId, post.board.classSectionId)
}

function revalidateBoard(boardId: string, classSectionId: string | null) {
  revalidatePath(`/admin/boards/${boardId}`)
  if (classSectionId) {
    revalidatePath(`/instructor/classes/${classSectionId}/boards/${boardId}`)
    revalidatePath(`/student/classes/${classSectionId}/boards/${boardId}`)
    revalidatePath(`/instructor/classes/${classSectionId}`)
    revalidatePath(`/student/classes/${classSectionId}`)
  }
}
