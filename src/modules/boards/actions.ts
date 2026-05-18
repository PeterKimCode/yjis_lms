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
  isClassBoardKind,
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

const boardSchema = z
  .object({
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
  .superRefine((data, context) => {
    if (isClassBoardKind(data.boardKind) && !data.classSectionId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Class boards require a class section.",
        path: ["classSectionId"],
      })
    }
    if (data.boardKind === "SCHOOL_ANNOUNCEMENTS" && data.classSectionId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "School announcements should not be attached to a class section.",
        path: ["classSectionId"],
      })
    }
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
    throw new Error(
      parsed.error.issues[0]?.message ??
        "Board title, type, and scope are required."
    )
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
  boardKind: z.enum([
    "CLASS_ANNOUNCEMENTS",
    "CLASS_QA",
    "CLASS_RESOURCES",
    "GENERAL_DISCUSSION",
  ]),
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

const boardIdSchema = z.object({
  boardId: requiredString,
})

export async function deactivateBoard(formData: FormData) {
  const data = boardIdSchema.parse(Object.fromEntries(formData.entries()))
  const access = await getBoardAccess(data.boardId)

  if (!access.board || !access.canManage) {
    throw new Error("You do not have permission to deactivate this board.")
  }

  await getPrismaClient().board.update({
    where: { id: access.board.id },
    data: { isActive: false },
  })
  revalidateBoard(access.board.id, access.board.classSectionId)
  revalidatePath("/admin/boards")
}

export async function deleteBoard(formData: FormData) {
  const data = boardIdSchema.parse(Object.fromEntries(formData.entries()))
  const access = await getBoardAccess(data.boardId)

  if (!access.board || !access.canManage) {
    throw new Error("You do not have permission to delete this board.")
  }

  const postCount = await getPrismaClient().post.count({
    where: { boardId: access.board.id },
  })

  if (postCount > 0) {
    await getPrismaClient().board.update({
      where: { id: access.board.id },
      data: { isActive: false },
    })
  } else {
    await getPrismaClient().board.delete({ where: { id: access.board.id } })
  }

  revalidatePath("/admin/boards")
  if (access.board.classSectionId) {
    revalidatePath(`/instructor/classes/${access.board.classSectionId}`)
    revalidatePath(`/student/classes/${access.board.classSectionId}`)
  }
}

const postSchema = z.object({
  boardId: requiredString,
  postId: optionalString,
  title: requiredString.max(200),
  body: requiredString.max(10000),
  isPinned: checkboxBoolean,
  isPublished: checkboxBoolean,
})

export async function createPost(formData: FormData) {
  const parsed = postSchema.safeParse({
    ...Object.fromEntries(formData.entries()),
    isPinned: formData.get("isPinned"),
    isPublished: "on",
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

export async function updatePost(formData: FormData) {
  const parsed = postSchema.safeParse({
    ...Object.fromEntries(formData.entries()),
    isPinned: formData.get("isPinned"),
    isPublished: formData.get("isPublished"),
  })

  if (!parsed.success || !parsed.data.postId) {
    throw new Error("Post title and content are required.")
  }

  const data = parsed.data
  const postId = data.postId as string
  const access = await getBoardAccess(data.boardId)
  const post = await getPrismaClient().post.findUniqueOrThrow({
    where: { id: postId },
    select: { authorId: true, boardId: true },
  })

  if (
    !access.user ||
    post.boardId !== data.boardId ||
    (!access.canManage && post.authorId !== access.user.id)
  ) {
    throw new Error("You do not have permission to edit this post.")
  }

  await getPrismaClient().post.update({
    where: { id: postId },
    data: {
      body: data.body,
      isPinned: access.canManage ? data.isPinned : false,
      publishedAt: access.canManage && !data.isPublished ? null : new Date(),
      title: data.title,
    },
  })

  if (access.board) revalidateBoard(access.board.id, access.board.classSectionId)
}

const postDeleteSchema = z.object({
  boardId: requiredString,
  postId: requiredString,
})

export async function deletePost(formData: FormData) {
  const data = postDeleteSchema.parse(Object.fromEntries(formData.entries()))
  const access = await getBoardAccess(data.boardId)
  const post = await getPrismaClient().post.findUniqueOrThrow({
    where: { id: data.postId },
    select: { authorId: true, boardId: true },
  })

  if (
    !access.user ||
    post.boardId !== data.boardId ||
    (!access.canManage && post.authorId !== access.user.id)
  ) {
    throw new Error("You do not have permission to delete this post.")
  }

  await getPrismaClient().post.delete({ where: { id: data.postId } })
  if (access.board) revalidateBoard(access.board.id, access.board.classSectionId)
}

const commentSchema = z.object({
  postId: requiredString,
  commentId: optionalString,
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

export async function updateComment(formData: FormData) {
  const parsed = commentSchema.safeParse(Object.fromEntries(formData.entries()))

  if (!parsed.success || !parsed.data.commentId) {
    throw new Error("Comment content is required.")
  }

  const data = parsed.data
  const commentId = data.commentId as string
  const comment = await getPrismaClient().comment.findUniqueOrThrow({
    where: { id: commentId },
    include: { post: { include: { board: true } } },
  })
  const access = await getBoardAccess(comment.post.boardId)

  if (
    !access.user ||
    comment.postId !== data.postId ||
    (!access.canManage && comment.authorId !== access.user.id)
  ) {
    throw new Error("You do not have permission to edit this comment.")
  }

  await getPrismaClient().comment.update({
    where: { id: comment.id },
    data: { body: data.body },
  })
  revalidateBoard(comment.post.boardId, comment.post.board.classSectionId)
}

const commentDeleteSchema = z.object({
  commentId: requiredString,
})

export async function deleteComment(formData: FormData) {
  const data = commentDeleteSchema.parse(Object.fromEntries(formData.entries()))
  const comment = await getPrismaClient().comment.findUniqueOrThrow({
    where: { id: data.commentId },
    include: { post: { include: { board: true } } },
  })
  const access = await getBoardAccess(comment.post.boardId)

  if (
    !access.user ||
    (!access.canManage && comment.authorId !== access.user.id)
  ) {
    throw new Error("You do not have permission to delete this comment.")
  }

  await getPrismaClient().comment.delete({ where: { id: comment.id } })
  revalidateBoard(comment.post.boardId, comment.post.board.classSectionId)
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
