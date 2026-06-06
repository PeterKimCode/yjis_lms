"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { NotificationType, type Prisma } from "@prisma/client"
import { z } from "zod"

import { getPrismaClient } from "@/lib/prisma"
import { assertAdminScope } from "@/modules/admin/access"
import { writeAuditLog } from "@/modules/audit/service"
import { canManageClassSection, requireAuth } from "@/modules/auth/permissions"
import {
  BOARD_KIND_OPTIONS,
  getBoardScopeTypeForKind,
  getBoardTypeForKind,
  isClassBoardKind,
} from "@/modules/boards/constants"
import { getBoardAccess } from "@/modules/boards/permissions"
import {
  imageUploadPolicy,
  validateImageUpload,
} from "@/modules/files/image-validation"
import { uploadImageFile } from "@/modules/files/upload"
import {
  createNotification,
  notifyClassInstructors,
  notifyClassStudents,
} from "@/modules/notifications/service"

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
  const actor = await requireAuth()
  const prisma = getPrismaClient()
  let scope = {
    organizationId: data.organizationId,
    campusId: data.campusId,
  }

  if (data.campusId) {
    const campus = await prisma.campus.findFirst({
      where: { id: data.campusId, organizationId: data.organizationId },
      select: { id: true },
    })

    if (!campus) {
      throw new Error("Selected campus does not belong to this organization.")
    }
  }

  if (data.classSectionId) {
    const classSection = await prisma.classSection.findUniqueOrThrow({
      where: { id: data.classSectionId },
      select: { organizationId: true, campusId: true },
    })
    if (classSection.organizationId !== data.organizationId) {
      throw new Error("Selected class section does not belong to this organization.")
    }
    if (data.campusId && classSection.campusId !== data.campusId) {
      throw new Error("Selected class section does not belong to this campus.")
    }
    scope = {
      organizationId: classSection.organizationId,
      campusId: classSection.campusId,
    }
  }

  await assertAdminScope(scope)
  const settings = {
    boardKind: data.boardKind,
    allowStudentPosts: data.allowStudentPosts,
    allowParentPosts: data.allowParentPosts,
    allowComments: data.allowComments,
  }
  const type = getBoardTypeForKind(data.boardKind)
  const scopeType = getBoardScopeTypeForKind(
    data.boardKind,
    Boolean(data.classSectionId)
  )

  const createValues: Prisma.BoardCreateInput = {
    organization: { connect: { id: scope.organizationId } },
    ...(scope.campusId
      ? { campus: { connect: { id: scope.campusId } } }
      : {}),
    ...(data.classSectionId
      ? { classSection: { connect: { id: data.classSectionId } } }
      : {}),
    description: data.description,
    isActive: data.isActive,
    name: data.name,
    scopeType,
    settings,
    type,
  }
  const updateValues: Prisma.BoardUpdateInput = {
    organization: { connect: { id: scope.organizationId } },
    campus: scope.campusId
      ? { connect: { id: scope.campusId } }
      : { disconnect: true },
    classSection: data.classSectionId
      ? { connect: { id: data.classSectionId } }
      : { disconnect: true },
    description: data.description,
    isActive: data.isActive,
    name: data.name,
    scopeType,
    settings,
    type,
  }

  const board = data.id
    ? await updateExistingBoard(data.id, updateValues)
    : await prisma.board.create({ data: createValues })

  await writeAuditLog({
    action: data.id ? "board.update" : "board.create",
    actorUserId: actor.id,
    campusId: board.campusId,
    entityId: board.id,
    entityType: "Board",
    metadata: {
      boardKind: data.boardKind,
      classSectionId: board.classSectionId,
      scopeType,
    },
    organizationId: board.organizationId,
    summary: `${data.id ? "Updated" : "Created"} board ${board.name}.`,
  })

  revalidatePath("/admin/boards")
  revalidatePath("/admin")
  revalidateBoard(board.id, board.classSectionId)
  redirect(`/admin/boards/${board.id}?boardSaved=1`)
}

async function updateExistingBoard(
  boardId: string,
  data: Prisma.BoardUpdateInput
) {
  const access = await getBoardAccess(boardId)

  if (!access.board || !access.canManage) {
    throw new Error("You do not have permission to update this board.")
  }

  return getPrismaClient().board.update({
    where: { id: boardId },
    data,
  })
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
  const board = await prisma.board.create({
    data: {
      organization: { connect: { id: classSection.organizationId } },
      ...(classSection.campusId
        ? { campus: { connect: { id: classSection.campusId } } }
        : {}),
      classSection: { connect: { id: data.classSectionId } },
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

  await writeAuditLog({
    action: "board.create",
    actorUserId: accessUser.id,
    campusId: board.campusId,
    entityId: board.id,
    entityType: "Board",
    metadata: {
      boardKind: data.boardKind,
      classSectionId: board.classSectionId,
      scopeType: board.scopeType,
    },
    organizationId: board.organizationId,
    summary: `Created class board ${board.name}.`,
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

  if (!access.board.isActive) {
    redirect(`/admin/boards/${access.board.id}?boardStatus=alreadyInactive`)
  }

  await getPrismaClient().board.update({
    where: { id: access.board.id },
    data: { isActive: false },
  })
  await writeAuditLog({
    action: "board.deactivate",
    actorUserId: access.user?.id,
    campusId: access.board.campusId,
    entityId: access.board.id,
    entityType: "Board",
    organizationId: access.board.organizationId,
    summary: `Deactivated board ${access.board.name}.`,
  })
  revalidateBoard(access.board.id, access.board.classSectionId)
  revalidatePath("/admin/boards")
  redirect(`/admin/boards/${access.board.id}?boardStatus=deactivated`)
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
    redirect(`/admin/boards/${access.board.id}?boardDeleteError=hasPosts`)
  }

  await getPrismaClient().board.delete({ where: { id: access.board.id } })
  await writeAuditLog({
    action: "board.delete",
    actorUserId: access.user?.id,
    campusId: access.board.campusId,
    entityId: access.board.id,
    entityType: "Board",
    organizationId: access.board.organizationId,
    summary: `Deleted empty board ${access.board.name}.`,
  })
  revalidatePath("/admin/boards")
  if (access.board.classSectionId) {
    revalidatePath(`/instructor/classes/${access.board.classSectionId}`)
    revalidatePath(`/student/classes/${access.board.classSectionId}`)
  }
  redirect("/admin/boards?boardDeleted=1")
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

  const images = getImageFiles(formData, "images")
  const imageValidation = await validateImageFiles(images, imageUploadPolicy.maxPostImages)
  if (!imageValidation.ok) {
    throw new Error(imageValidation.message)
  }

  const post = await getPrismaClient().post.create({
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

  await attachImagesToPost(post.id, images, access.board, access.user.id)
  await writeAuditLog({
    action: "board.post.create",
    actorUserId: access.user.id,
    campusId: access.board.campusId,
    entityId: post.id,
    entityType: "Post",
    metadata: {
      boardId: access.board.id,
      imageCount: images.length,
    },
    organizationId: access.board.organizationId,
    summary: `Created post ${post.title}.`,
  })
  await notifyBoardPostCreated({
    authorId: access.user.id,
    boardId: access.board.id,
    body: data.body,
    classSectionId: access.board.classSectionId,
    postId: post.id,
    title: data.title,
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

  const images = getImageFiles(formData, "images")
  const existingImageCount = await getPrismaClient().postAttachment.count({
    where: { postId },
  })
  const remainingSlots = imageUploadPolicy.maxPostImages - existingImageCount
  const imageValidation = await validateImageFiles(images, remainingSlots)
  if (!imageValidation.ok) {
    throw new Error(imageValidation.message)
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

  if (access.board) {
    await attachImagesToPost(postId, images, access.board, access.user.id)
  }
  if (access.board) {
    await writeAuditLog({
      action: "board.post.update",
      actorUserId: access.user.id,
      campusId: access.board.campusId,
      entityId: postId,
      entityType: "Post",
      metadata: {
        boardId: access.board.id,
        addedImageCount: images.length,
      },
      organizationId: access.board.organizationId,
      summary: `Updated post ${data.title}.`,
    })
  }
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
  if (access.board) {
    await writeAuditLog({
      action: "board.post.delete",
      actorUserId: access.user.id,
      campusId: access.board.campusId,
      entityId: data.postId,
      entityType: "Post",
      metadata: { boardId: access.board.id },
      organizationId: access.board.organizationId,
      summary: "Deleted board post.",
    })
    revalidateBoard(access.board.id, access.board.classSectionId)
  }
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

  const images = getImageFiles(formData, "image")
  const imageValidation = await validateImageFiles(
    images,
    imageUploadPolicy.maxCommentImages
  )
  if (!imageValidation.ok) {
    throw new Error(imageValidation.message)
  }

  const comment = await getPrismaClient().comment.create({
    data: {
      organizationId: post.organizationId,
      authorId: access.user.id,
      body: data.body,
      postId: post.id,
    },
  })

  await attachImagesToComment(comment.id, images, post.board, access.user.id)
  await writeAuditLog({
    action: "board.comment.create",
    actorUserId: access.user.id,
    campusId: post.board.campusId,
    entityId: comment.id,
    entityType: "Comment",
    metadata: {
      boardId: post.boardId,
      imageCount: images.length,
      postId: post.id,
    },
    organizationId: post.board.organizationId,
    summary: "Created board comment.",
  })
  if (post.authorId && post.authorId !== access.user.id) {
    await createNotification({
      actionUrl: "/notifications",
      body: truncatePreview(data.body),
      entityId: comment.id,
      entityType: "Comment",
      title: "New comment on your post",
      type: NotificationType.NEW_BOARD_COMMENT,
      userId: post.authorId,
    })
  }
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

  const images = getImageFiles(formData, "image")
  const imageValidation = await validateImageFiles(
    images,
    imageUploadPolicy.maxCommentImages
  )
  if (!imageValidation.ok) {
    throw new Error(imageValidation.message)
  }

  await getPrismaClient().comment.update({
    where: { id: comment.id },
    data: { body: data.body },
  })
  if (images.length) {
    await getPrismaClient().commentAttachment.deleteMany({
      where: { commentId: comment.id },
    })
    await attachImagesToComment(
      comment.id,
      images,
      comment.post.board,
      access.user.id
    )
  }
  await writeAuditLog({
    action: "board.comment.update",
    actorUserId: access.user.id,
    campusId: comment.post.board.campusId,
    entityId: comment.id,
    entityType: "Comment",
    metadata: {
      boardId: comment.post.boardId,
      replacedImage: images.length > 0,
      postId: comment.postId,
    },
    organizationId: comment.post.board.organizationId,
    summary: "Updated board comment.",
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
  await writeAuditLog({
    action: "board.comment.delete",
    actorUserId: access.user.id,
    campusId: comment.post.board.campusId,
    entityId: comment.id,
    entityType: "Comment",
    metadata: {
      boardId: comment.post.boardId,
      postId: comment.postId,
    },
    organizationId: comment.post.board.organizationId,
    summary: "Deleted board comment.",
  })
  revalidateBoard(comment.post.boardId, comment.post.board.classSectionId)
}

const postAttachmentDeleteSchema = z.object({
  boardId: requiredString,
  attachmentId: requiredString,
})

export async function deletePostAttachment(formData: FormData) {
  const data = postAttachmentDeleteSchema.parse(Object.fromEntries(formData.entries()))
  const attachment = await getPrismaClient().postAttachment.findUniqueOrThrow({
    where: { id: data.attachmentId },
    include: { post: { include: { board: true } } },
  })
  const access = await getBoardAccess(attachment.post.boardId)

  if (
    !access.user ||
    attachment.post.boardId !== data.boardId ||
    (!access.canManage && attachment.post.authorId !== access.user.id)
  ) {
    throw new Error("You do not have permission to remove this image.")
  }

  await getPrismaClient().postAttachment.delete({
    where: { id: attachment.id },
  })
  await writeAuditLog({
    action: "board.post_image.delete",
    actorUserId: access.user.id,
    campusId: attachment.post.board.campusId,
    entityId: attachment.id,
    entityType: "PostAttachment",
    metadata: {
      boardId: attachment.post.boardId,
      fileAssetId: attachment.fileAssetId,
      postId: attachment.postId,
    },
    organizationId: attachment.post.board.organizationId,
    summary: "Removed image from board post.",
  })
  revalidateBoard(attachment.post.boardId, attachment.post.board.classSectionId)
}

const commentAttachmentDeleteSchema = z.object({
  attachmentId: requiredString,
})

export async function deleteCommentAttachment(formData: FormData) {
  const data = commentAttachmentDeleteSchema.parse(
    Object.fromEntries(formData.entries())
  )
  const attachment = await getPrismaClient().commentAttachment.findUniqueOrThrow({
    where: { id: data.attachmentId },
    include: {
      comment: {
        include: {
          post: { include: { board: true } },
        },
      },
    },
  })
  const access = await getBoardAccess(attachment.comment.post.boardId)

  if (
    !access.user ||
    (!access.canManage && attachment.comment.authorId !== access.user.id)
  ) {
    throw new Error("You do not have permission to remove this image.")
  }

  await getPrismaClient().commentAttachment.delete({
    where: { id: attachment.id },
  })
  await writeAuditLog({
    action: "board.comment_image.delete",
    actorUserId: access.user.id,
    campusId: attachment.comment.post.board.campusId,
    entityId: attachment.id,
    entityType: "CommentAttachment",
    metadata: {
      boardId: attachment.comment.post.boardId,
      commentId: attachment.commentId,
      fileAssetId: attachment.fileAssetId,
    },
    organizationId: attachment.comment.post.board.organizationId,
    summary: "Removed image from board comment.",
  })
  revalidateBoard(
    attachment.comment.post.boardId,
    attachment.comment.post.board.classSectionId
  )
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

function getImageFiles(formData: FormData, fieldName: string) {
  return formData
    .getAll(fieldName)
    .filter((value): value is File => value instanceof File && value.size > 0)
}

async function validateImageFiles(files: File[], maxCount: number) {
  if (files.length > maxCount) {
    return {
      ok: false as const,
      message:
        maxCount === imageUploadPolicy.maxPostImages
          ? "You can attach up to 5 images per post."
          : "You can attach one image per comment.",
    }
  }

  for (const file of files) {
    const validation = await validateImageUpload(file)
    if (!validation.ok) return validation
  }

  return { ok: true as const }
}

async function attachImagesToPost(
  postId: string,
  images: File[],
  board: {
    campusId: string | null
    classSectionId: string | null
    organizationId: string
  },
  ownerId: string
) {
  for (const image of images) {
    const upload = await uploadImageFile({
      file: image,
      ownerId,
      organizationId: board.organizationId,
      campusId: board.campusId,
      classSectionId: board.classSectionId,
      prefix: `boards/posts/${postId}`,
      metadata: {
        source: "board-post-image",
        postId,
      },
    })

    if (!upload.ok) throw new Error(upload.message)

    await getPrismaClient().postAttachment.create({
      data: {
        postId,
        fileAssetId: upload.fileAsset.id,
      },
    })
  }
}

async function attachImagesToComment(
  commentId: string,
  images: File[],
  board: {
    campusId: string | null
    classSectionId: string | null
    organizationId: string
  },
  ownerId: string
) {
  for (const image of images) {
    const upload = await uploadImageFile({
      file: image,
      ownerId,
      organizationId: board.organizationId,
      campusId: board.campusId,
      classSectionId: board.classSectionId,
      prefix: `boards/comments/${commentId}`,
      metadata: {
        source: "board-comment-image",
        commentId,
      },
    })

    if (!upload.ok) throw new Error(upload.message)

    await getPrismaClient().commentAttachment.create({
      data: {
        commentId,
        fileAssetId: upload.fileAsset.id,
      },
    })
  }
}

async function notifyBoardPostCreated({
  authorId,
  boardId,
  body,
  classSectionId,
  postId,
  title,
}: {
  authorId: string
  boardId: string
  body: string
  classSectionId: string | null
  postId: string
  title: string
}) {
  if (!classSectionId) return

  await Promise.all([
    notifyClassStudents(classSectionId, {
      actionUrl: `/student/classes/${classSectionId}/boards/${boardId}`,
      actorUserId: authorId,
      body: truncatePreview(body),
      entityId: postId,
      entityType: "Post",
      title: `New board post: ${title}`,
      type: NotificationType.NEW_BOARD_POST,
    }),
    notifyClassInstructors(classSectionId, {
      actionUrl: `/instructor/classes/${classSectionId}/boards/${boardId}`,
      actorUserId: authorId,
      body: truncatePreview(body),
      entityId: postId,
      entityType: "Post",
      title: `New board post: ${title}`,
      type: NotificationType.NEW_BOARD_POST,
    }),
  ])
}

function truncatePreview(value: string) {
  return value.length > 120 ? `${value.slice(0, 117)}...` : value
}
