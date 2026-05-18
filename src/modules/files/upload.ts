import "server-only"

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { FileVisibility, type Prisma } from "@prisma/client"

import { getPrismaClient } from "@/lib/prisma"
import { validateImageUpload } from "@/modules/files/image-validation"

export async function uploadImageFile({
  campusId,
  classSectionId,
  file,
  metadata,
  organizationId,
  ownerId,
  prefix,
}: {
  campusId?: string | null
  classSectionId?: string | null
  file: File
  metadata?: Prisma.InputJsonValue
  organizationId: string
  ownerId: string
  prefix: string
}) {
  const validation = await validateImageUpload(file)

  if (!validation.ok) {
    return validation
  }

  const bucket = process.env.S3_BUCKET_NAME ?? "lms-files"
  const objectKey = [
    ...safePrefix(prefix),
    `${crypto.randomUUID()}-${validation.safeName}`,
  ].join("/")

  await createS3Client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: Buffer.from(await file.arrayBuffer()),
      ContentType: validation.contentType,
    })
  )

  const fileAsset = await createFileAssetForUpload({
    bucket,
    campusId,
    classSectionId,
    contentType: validation.contentType,
    metadata,
    objectKey,
    organizationId,
    ownerId,
    safeName: validation.safeName,
    size: file.size,
  })

  return {
    ok: true as const,
    fileAsset,
  }
}

export async function createFileAssetForUpload({
  bucket,
  campusId,
  classSectionId,
  contentType,
  metadata,
  objectKey,
  organizationId,
  ownerId,
  safeName,
  size,
}: {
  bucket: string
  campusId?: string | null
  classSectionId?: string | null
  contentType: string
  metadata?: Prisma.InputJsonValue
  objectKey: string
  organizationId: string
  ownerId: string
  safeName: string
  size: number
}) {
  return getPrismaClient().fileAsset.create({
    data: {
      organizationId,
      campusId,
      classSectionId,
      uploadedById: ownerId,
      bucket,
      objectKey,
      originalName: safeName,
      contentType,
      byteSize: BigInt(size),
      visibility: classSectionId
        ? FileVisibility.CLASS_SECTION
        : FileVisibility.PRIVATE,
      metadata,
    },
  })
}

function safePrefix(prefix: string) {
  return prefix
    .split("/")
    .map((segment) => segment.trim().replace(/[^A-Za-z0-9._-]/g, "-"))
    .filter(Boolean)
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
