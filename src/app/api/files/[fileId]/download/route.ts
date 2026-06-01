import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3"
import type { Readable } from "node:stream"
import { NextResponse } from "next/server"
import { UserRole } from "@prisma/client"

import { getPrismaClient } from "@/lib/prisma"
import {
  canManageClassSection,
  canViewClassSection,
  canViewStudentData,
} from "@/modules/auth/permissions"
import { getCurrentSession } from "@/modules/auth/session"
import { getBoardAccess } from "@/modules/boards/permissions"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const session = await getCurrentSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { fileId } = await params
  const file = await getPrismaClient().fileAsset.findUnique({
    where: { id: fileId },
    select: {
      bucket: true,
      id: true,
      objectKey: true,
      originalName: true,
      contentType: true,
      byteSize: true,
      uploadedById: true,
      classSectionId: true,
      assignmentSubmission: {
        select: {
          studentId: true,
          assignment: {
            select: {
              classSectionId: true,
            },
          },
        },
      },
      postAttachments: {
        select: {
          post: {
            select: {
              boardId: true,
            },
          },
        },
      },
      commentAttachments: {
        select: {
          comment: {
            select: {
              post: {
                select: {
                  boardId: true,
                },
              },
            },
          },
        },
      },
    },
  })

  if (!file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  try {
    if (!(await canDownloadFile(session.user.id, file))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const requestedInline =
      new URL(request.url).searchParams.get("disposition") === "inline"
    const disposition =
      requestedInline && file.contentType?.startsWith("image/")
        ? "inline"
        : "attachment"
    const object = await createS3Client().send(
      new GetObjectCommand({
        Bucket: file.bucket,
        Key: file.objectKey,
      })
    )

    if (!object.Body) {
      return NextResponse.json(
        { error: "File object not found" },
        { status: 404 }
      )
    }

    const bytes = await readS3Body(object.Body)
    const headers = new Headers({
      "Content-Disposition": getContentDisposition(
        file.originalName,
        disposition
      ),
      "Content-Type": file.contentType ?? "application/octet-stream",
      "Content-Length": String(file.byteSize ?? bytes.byteLength),
      "X-Content-Type-Options": "nosniff",
    })

    return new Response(bytes, { headers })
  } catch (error) {
    if (isMissingObjectError(error)) {
      return NextResponse.json(
        { error: "File object not found" },
        { status: 404 }
      )
    }

    console.error("File download failed", {
      fileId,
      objectKey: file.objectKey,
      bucket: file.bucket,
      error: error instanceof Error ? error.message : String(error),
    })

    return NextResponse.json(
      { error: "File storage is temporarily unavailable" },
      { status: 500 }
    )
  }
}

async function canDownloadFile(
  userId: string,
  file: {
    id: string
    uploadedById: string | null
    classSectionId: string | null
    assignmentSubmission: {
      studentId: string
      assignment: {
        classSectionId: string
      }
    } | null
    postAttachments: {
      post: {
        boardId: string
      }
    }[]
    commentAttachments: {
      comment: {
        post: {
          boardId: string
        }
      }
    }[]
  }
) {
  if (file.uploadedById === userId) {
    return true
  }

  const avatarOwner = await getPrismaClient().user.findFirst({
    where: { avatarFileAssetId: file.id },
    select: {
      id: true,
      organizationId: true,
      studentProfile: {
        select: {
          campusId: true,
        },
      },
    },
  })

  if (avatarOwner) {
    if (await canViewStudentData(userId, avatarOwner.id)) {
      return true
    }

    const viewer = await getPrismaClient().user.findUnique({
      where: { id: userId },
      select: {
        roleAssignments: {
          select: {
            organizationId: true,
            campusId: true,
            role: true,
          },
        },
      },
    })

    return Boolean(
      viewer?.roleAssignments.some((assignment) => {
        if (assignment.role === UserRole.SUPER_ADMIN) return true
        if (assignment.organizationId !== avatarOwner.organizationId) return false
        if (
          assignment.role === UserRole.ORG_ADMIN ||
          assignment.role === UserRole.ACADEMIC_STAFF
        ) {
          return !assignment.campusId
        }
        if (assignment.role === UserRole.SCHOOL_ADMIN) {
          return (
            Boolean(assignment.campusId) &&
            assignment.campusId === avatarOwner.studentProfile?.campusId
          )
        }
        return false
      })
    )
  }

  const logoOrganizations = await getPrismaClient().$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "Organization" WHERE "logoFileAssetId" = ${file.id}
  `

  if (logoOrganizations.length) {
    const logoOrganizationIds = new Set(logoOrganizations.map((organization) => organization.id))
    const user = await getPrismaClient().user.findUnique({
      where: { id: userId },
      select: {
        organizationId: true,
        roleAssignments: {
          select: {
            organizationId: true,
            role: true,
          },
        },
      },
    })

    return Boolean(
      user &&
        (logoOrganizationIds.has(user.organizationId) ||
          user.roleAssignments.some(
            (assignment) =>
              assignment.role === UserRole.SUPER_ADMIN ||
              logoOrganizationIds.has(assignment.organizationId)
          ))
    )
  }

  if (file.assignmentSubmission) {
    return (
      userId === file.assignmentSubmission.studentId ||
      (await canViewStudentData(userId, file.assignmentSubmission.studentId)) ||
      (await canManageClassSection(
        userId,
        file.assignmentSubmission.assignment.classSectionId
      ))
    )
  }

  for (const attachment of file.postAttachments) {
    const access = await getBoardAccess(attachment.post.boardId)
    if (access.canView) return true
  }

  for (const attachment of file.commentAttachments) {
    const access = await getBoardAccess(attachment.comment.post.boardId)
    if (access.canView) return true
  }

  if (file.classSectionId) {
    return canViewClassSection(userId, file.classSectionId)
  }

  return false
}

function getContentDisposition(name: string, disposition: "attachment" | "inline") {
  const extension = getSafeExtension(name)
  const asciiFallback = `download${extension}`.replace(/["\r\n]/g, "_")
  const encodedName = encodeURIComponent(name).replace(/['()]/g, (value) =>
    `%${value.charCodeAt(0).toString(16).toUpperCase()}`
  )

  return `${disposition}; filename="${asciiFallback}"; filename*=UTF-8''${encodedName}`
}

function getSafeExtension(name: string) {
  const match = /\.[A-Za-z0-9]{1,12}$/.exec(name)

  return match?.[0] ?? ""
}

async function readS3Body(body: unknown) {
  if (
    body &&
    typeof body === "object" &&
    "transformToByteArray" in body &&
    typeof body.transformToByteArray === "function"
  ) {
    return await body.transformToByteArray()
  }

  if (body instanceof Uint8Array) {
    return body
  }

  if (body instanceof ReadableStream) {
    return new Uint8Array(await new Response(body).arrayBuffer())
  }

  if (isNodeReadable(body)) {
    const chunks: Uint8Array[] = []

    for await (const chunk of body) {
      chunks.push(
        typeof chunk === "string" ? new TextEncoder().encode(chunk) : chunk
      )
    }

    return concatChunks(chunks)
  }

  throw new Error("Unsupported file body stream")
}

function isNodeReadable(value: unknown): value is Readable {
  if (!value || typeof value !== "object") {
    return false
  }

  return Symbol.asyncIterator in value
}

function concatChunks(chunks: Uint8Array[]) {
  const totalLength = chunks.reduce((total, chunk) => total + chunk.byteLength, 0)
  const bytes = new Uint8Array(totalLength)
  let offset = 0

  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }

  return bytes
}

function isMissingObjectError(error: unknown) {
  if (!(error instanceof Error)) return false

  return ["NoSuchKey", "NotFound", "NoSuchBucket"].includes(error.name)
}

function createS3Client() {
  return new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? "us-east-1",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
    },
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
  })
}
