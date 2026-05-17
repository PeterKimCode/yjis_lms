import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3"
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
    return NextResponse.json({ error: "File body not found" }, { status: 404 })
  }

  const body = object.Body.transformToWebStream()

  return new Response(body, {
    headers: {
      "Content-Disposition": `attachment; filename="${encodeHeaderFileName(file.originalName)}"`,
      "Content-Type": file.contentType ?? "application/octet-stream",
    },
  })
}

async function canDownloadFile(
  userId: string,
  file: {
    classSectionId: string | null
    assignmentSubmission: {
      studentId: string
      assignment: {
        classSectionId: string
      }
    } | null
  }
) {
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
