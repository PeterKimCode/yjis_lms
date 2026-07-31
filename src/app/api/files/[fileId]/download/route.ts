import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { Readable } from "node:stream"
import { NextResponse } from "next/server"
import { UserRole } from "@prisma/client"

import { getPrismaClient } from "@/lib/prisma"
import { writeAuditLog } from "@/modules/audit/service"
import {
  canManageClassSection,
  canViewClassSection,
  canViewStudentData,
} from "@/modules/auth/permissions"
import { getCurrentSession } from "@/modules/auth/session"
import { getBoardAccess } from "@/modules/boards/permissions"

const VIDEO_RANGE_CHUNK_BYTES = 8 * 1024 * 1024

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
      campusId: true,
      id: true,
      objectKey: true,
      organizationId: true,
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
    const canRenderInline =
      file.contentType?.startsWith("image/") ||
      file.contentType?.startsWith("video/") ||
      file.contentType === "application/pdf"
    const disposition =
      canRenderInline && (requestedInline || file.contentType?.startsWith("video/"))
        ? "inline"
        : "attachment"
    const isVideo = file.contentType?.startsWith("video/") ?? false
    const totalSize = file.byteSize ? Number(file.byteSize) : null
    const range = parseRangeHeader(request.headers.get("range"), totalSize, {
      maxChunkBytes: isVideo ? VIDEO_RANGE_CHUNK_BYTES : undefined,
    })

    if (range?.invalid) {
      return new Response("Requested range not satisfiable", {
        status: 416,
        headers: totalSize
          ? {
              "Content-Range": `bytes */${totalSize}`,
              "Accept-Ranges": "bytes",
            }
          : undefined,
      })
    }

    const object = await createS3Client().send(
      new GetObjectCommand({
        Bucket: file.bucket,
        Key: file.objectKey,
        Range: range ? `bytes=${range.start}-${range.end}` : undefined,
      })
    )

    if (!object.Body) {
      return NextResponse.json(
        { error: "File object not found" },
        { status: 404 }
      )
    }

    const body = toResponseBody(object.Body)
    const contentLength = range
      ? range.end - range.start + 1
      : (totalSize ?? object.ContentLength)
    const headers = new Headers({
      "Content-Disposition": getContentDisposition(
        file.originalName,
        disposition
      ),
      "Content-Type": file.contentType ?? "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, no-store",
      "X-Accel-Buffering": "no",
    })

    if (contentLength !== undefined) {
      headers.set("Content-Length", String(contentLength))
    }

    if (range && totalSize) {
      headers.set("Content-Range", `bytes ${range.start}-${range.end}/${totalSize}`)
    }

    if (!range) {
      await writeAuditLog({
        action: disposition === "inline" ? "file.view" : "file.download",
        actorUserId: session.user.id,
        campusId: file.campusId,
        entityId: file.id,
        entityType: "FileAsset",
        metadata: {
          contentType: file.contentType ?? null,
          disposition,
        },
        organizationId: file.organizationId,
        summary: `${disposition === "inline" ? "Viewed" : "Downloaded"} file ${file.originalName}.`,
      })
    }

    return new Response(body, { headers, status: range ? 206 : 200 })
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

  if (await userHasSuperAdminRole(userId)) {
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

async function userHasSuperAdminRole(userId: string) {
  const user = await getPrismaClient().user.findUnique({
    where: { id: userId },
    select: {
      roleAssignments: {
        where: { role: UserRole.SUPER_ADMIN },
        select: { id: true },
        take: 1,
      },
    },
  })

  return Boolean(user?.roleAssignments.length)
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

function toResponseBody(body: unknown): BodyInit {
  if (
    body &&
    typeof body === "object" &&
    "transformToWebStream" in body &&
    typeof body.transformToWebStream === "function"
  ) {
    return body.transformToWebStream() as ReadableStream<Uint8Array>
  }

  if (body instanceof Uint8Array) {
    return new Uint8Array(body).buffer
  }

  if (body instanceof ReadableStream) {
    return body
  }

  if (isNodeReadable(body)) {
    return Readable.toWeb(body) as ReadableStream<Uint8Array>
  }

  throw new Error("Unsupported file body stream")
}

function isNodeReadable(value: unknown): value is Readable {
  if (!value || typeof value !== "object") {
    return false
  }

  return Symbol.asyncIterator in value
}

function isMissingObjectError(error: unknown) {
  if (!(error instanceof Error)) return false

  return ["NoSuchKey", "NotFound", "NoSuchBucket"].includes(error.name)
}

function parseRangeHeader(
  rangeHeader: string | null,
  totalSize: number | null,
  options: { maxChunkBytes?: number } = {}
) {
  if (!rangeHeader) return null
  if (!totalSize || !Number.isFinite(totalSize) || totalSize <= 0) {
    return { invalid: true as const }
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim())
  if (!match) return { invalid: true as const }

  const [, rawStart, rawEnd] = match
  if (!rawStart && !rawEnd) return { invalid: true as const }

  let start: number
  let end: number

  if (!rawStart) {
    const suffixLength = Number(rawEnd)
    if (!Number.isInteger(suffixLength) || suffixLength <= 0) {
      return { invalid: true as const }
    }
    start = Math.max(totalSize - suffixLength, 0)
    end = totalSize - 1
  } else {
    start = Number(rawStart)
    end = rawEnd ? Number(rawEnd) : totalSize - 1
  }

  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end < start ||
    start >= totalSize
  ) {
    return { invalid: true as const }
  }

  if (options.maxChunkBytes && end - start + 1 > options.maxChunkBytes) {
    end = start + options.maxChunkBytes - 1
  }

  return {
    start,
    end: Math.min(end, totalSize - 1),
  }
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
