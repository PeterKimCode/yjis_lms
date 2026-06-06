import "server-only"

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"

import { getPrismaClient } from "@/lib/prisma"
import { writeAuditLog } from "@/modules/audit/service"
import { canManageClassSection } from "@/modules/auth/permissions"
import { validateAssignmentAttachment } from "@/modules/files/upload-validation"

export async function uploadLessonAttachmentFile({
  classSectionId,
  file,
  instructorId,
}: {
  classSectionId: string
  file: File
  instructorId: string
}) {
  if (!(await canManageClassSection(instructorId, classSectionId))) {
    throw new LessonFileUploadError("Forbidden", 403)
  }

  if (file.size === 0) {
    throw new LessonFileUploadError("Choose a lesson file to upload.", 400)
  }

  const validation = validateAssignmentAttachment(file)
  if (!validation.ok) {
    throw new LessonFileUploadError(validation.message, 400)
  }

  const prisma = getPrismaClient()
  const classSection = await prisma.classSection.findUniqueOrThrow({
    where: { id: classSectionId },
    select: { organizationId: true, campusId: true },
  })
  const bucket = process.env.S3_BUCKET_NAME ?? "lms-files"
  const objectKey = `lessons/files/${classSectionId}/${crypto.randomUUID()}-${validation.safeName}`

  await createS3Client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: Buffer.from(await file.arrayBuffer()),
      ContentType: validation.contentType,
    })
  )

  const fileAsset = await prisma.fileAsset.create({
    data: {
      organizationId: classSection.organizationId,
      campusId: classSection.campusId,
      classSectionId,
      uploadedById: instructorId,
      bucket,
      objectKey,
      originalName: validation.safeName,
      contentType: validation.contentType,
      byteSize: BigInt(file.size),
      visibility: "CLASS_SECTION",
      metadata: {
        source: "lesson-file-upload",
      },
    },
  })

  await writeAuditLog({
    action: "file.upload",
    actorUserId: instructorId,
    campusId: classSection.campusId,
    entityId: fileAsset.id,
    entityType: "FileAsset",
    metadata: {
      classSectionId,
      contentType: fileAsset.contentType,
      source: "lesson-file-upload",
    },
    organizationId: classSection.organizationId,
    summary: `Uploaded lesson file ${fileAsset.originalName}.`,
  })

  return fileAsset
}

export class LessonFileUploadError extends Error {
  constructor(
    message: string,
    public readonly status = 500
  ) {
    super(message)
    this.name = "LessonFileUploadError"
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
