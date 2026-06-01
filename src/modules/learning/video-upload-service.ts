import "server-only"

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"

import { getPrismaClient } from "@/lib/prisma"
import { canManageClassSection } from "@/modules/auth/permissions"

export async function uploadLessonVideoFile({
  classSectionId,
  file,
  instructorId,
}: {
  classSectionId: string
  file: File
  instructorId: string
}) {
  if (!(await canManageClassSection(instructorId, classSectionId))) {
    throw new LessonVideoUploadError("Forbidden", 403)
  }

  if (file.size === 0) {
    throw new LessonVideoUploadError("Choose a video file to upload.", 400)
  }

  if (!isVideoFile(file.name, file.type)) {
    throw new LessonVideoUploadError(
      "Upload an MP4, WebM, MOV, or M4V video file.",
      400
    )
  }

  const prisma = getPrismaClient()
  const classSection = await prisma.classSection.findUniqueOrThrow({
    where: { id: classSectionId },
    select: { organizationId: true, campusId: true },
  })
  const bucket = process.env.S3_BUCKET_NAME ?? "lms-files"
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-")
  const objectKey = `videos/${classSectionId}/${Date.now()}-${safeName}`

  await createS3Client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: Buffer.from(await file.arrayBuffer()),
      ContentType: file.type || "application/octet-stream",
    })
  )

  return prisma.fileAsset.create({
    data: {
      organizationId: classSection.organizationId,
      campusId: classSection.campusId,
      classSectionId,
      uploadedById: instructorId,
      bucket,
      objectKey,
      originalName: file.name,
      contentType: file.type || "application/octet-stream",
      byteSize: BigInt(file.size),
      visibility: "CLASS_SECTION",
      metadata: {
        source: "lesson-video-upload",
      },
    },
  })
}

export function isVideoFile(name: string, contentType: string) {
  return (
    contentType.startsWith("video/") ||
    /\.(mp4|webm|mov|m4v)$/i.test(name)
  )
}

export class LessonVideoUploadError extends Error {
  constructor(
    message: string,
    public readonly status = 500
  ) {
    super(message)
    this.name = "LessonVideoUploadError"
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
