import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3"
import type { Readable } from "node:stream"
import { NextResponse } from "next/server"

import { getPrismaClient } from "@/lib/prisma"
import {
  canManageClassSection,
  canViewClassSection,
  canViewStudentData,
} from "@/modules/auth/permissions"
import { getCurrentSession } from "@/modules/auth/session"

export async function GET(
  _request: Request,
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
    },
  })

  if (!file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  try {
    if (!(await canDownloadFile(session.user.id, file))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

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
      "Content-Disposition": `attachment; filename="${encodeHeaderFileName(file.originalName)}"`,
      "Content-Type": file.contentType ?? "application/octet-stream",
      "Content-Length": String(file.byteSize ?? bytes.byteLength),
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
    uploadedById: string | null
    classSectionId: string | null
    assignmentSubmission: {
      studentId: string
      assignment: {
        classSectionId: string
      }
    } | null
  }
) {
  if (file.uploadedById === userId) {
    return true
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

  if (file.classSectionId) {
    return canViewClassSection(userId, file.classSectionId)
  }

  return false
}

function encodeHeaderFileName(name: string) {
  return name.replace(/["\r\n]/g, "_")
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
