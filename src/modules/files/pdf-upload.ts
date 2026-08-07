import "server-only"

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { FileVisibility } from "@prisma/client"

import { getPrismaClient } from "@/lib/prisma"
import { writeAuditLog } from "@/modules/audit/service"
import { sanitizeFileName } from "@/modules/files/upload-validation"

const MAX_PDF_UPLOAD_BYTES = 20 * 1024 * 1024

export class PdfUploadError extends Error {
  constructor(
    message: string,
    public readonly status = 400
  ) {
    super(message)
    this.name = "PdfUploadError"
  }
}

export async function uploadClassPdfAttachment({
  actorUserId,
  classSectionId,
  file,
  organizationId,
  prefix,
}: {
  actorUserId: string
  classSectionId: string
  file: File
  organizationId: string
  prefix: "assignments" | "quizzes" | "exams"
}) {
  const validation = await validatePdfUpload(file)
  const prisma = getPrismaClient()
  const classSection = await prisma.classSection.findUnique({
    where: { id: classSectionId },
    select: { campusId: true, organizationId: true },
  })

  if (!classSection || classSection.organizationId !== organizationId) {
    throw new PdfUploadError("Class section was not found.", 404)
  }

  const bucket = process.env.S3_BUCKET_NAME ?? "lms-files"
  const objectKey = [
    prefix,
    "pdfs",
    classSectionId,
    `${crypto.randomUUID()}-${validation.safeName}`,
  ].join("/")

  await createS3Client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: Buffer.from(await file.arrayBuffer()),
      ContentType: "application/pdf",
    })
  )

  const fileAsset = await prisma.fileAsset.create({
    data: {
      organizationId,
      campusId: classSection.campusId,
      classSectionId,
      uploadedById: actorUserId,
      bucket,
      objectKey,
      originalName: validation.safeName,
      contentType: "application/pdf",
      byteSize: BigInt(file.size),
      visibility: FileVisibility.CLASS_SECTION,
      metadata: {
        source: `${prefix}-pdf-attachment`,
      },
    },
  })

  await writeAuditLog({
    action: "file.upload",
    actorUserId,
    campusId: classSection.campusId,
    entityId: fileAsset.id,
    entityType: "FileAsset",
    metadata: {
      classSectionId,
      contentType: fileAsset.contentType,
      source: `${prefix}-pdf-attachment`,
    },
    organizationId,
    summary: `Uploaded PDF attachment ${fileAsset.originalName}.`,
  })

  return fileAsset
}

export async function validatePdfUpload(file: File) {
  if (file.size === 0) {
    throw new PdfUploadError("Choose a PDF file to upload.")
  }

  if (file.size > MAX_PDF_UPLOAD_BYTES) {
    throw new PdfUploadError("PDF must be 20MB or smaller.")
  }

  const safeName = sanitizeFileName(file.name)
  if (!/\.pdf$/i.test(safeName)) {
    throw new PdfUploadError("Only PDF files are allowed.")
  }

  if (
    file.type &&
    file.type !== "application/octet-stream" &&
    file.type !== "application/pdf"
  ) {
    throw new PdfUploadError("Only PDF files are allowed.")
  }

  const signature = new Uint8Array(await file.slice(0, 5).arrayBuffer())
  const isPdf =
    signature[0] === 0x25 &&
    signature[1] === 0x50 &&
    signature[2] === 0x44 &&
    signature[3] === 0x46 &&
    signature[4] === 0x2d

  if (!isPdf) {
    throw new PdfUploadError("This PDF file could not be verified.")
  }

  return { safeName }
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
