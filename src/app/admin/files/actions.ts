"use server"

import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { getPrismaClient } from "@/lib/prisma"
import { isSuperAdmin, requireAdmin } from "@/modules/admin/access"
import { writeAuditLog } from "@/modules/audit/service"

export async function deleteFileAssetAction(formData: FormData) {
  const admin = await requireAdmin()
  const fileId = String(formData.get("fileId") ?? "").trim()

  if (!isSuperAdmin(admin)) {
    redirectWithMessage("deleteError", "Only Super Admin can delete files.")
  }

  if (!fileId) {
    redirectWithMessage("deleteError", "File was not found.")
  }

  const prisma = getPrismaClient()
  const file = await prisma.fileAsset.findUnique({
    where: { id: fileId },
    select: {
      bucket: true,
      campusId: true,
      id: true,
      objectKey: true,
      organizationId: true,
      originalName: true,
      contentType: true,
    },
  })

  if (!file) {
    redirectWithMessage("deleteError", "File was not found.")
  }

  await prisma.fileAsset.delete({
    where: { id: file.id },
  })

  await writeAuditLog({
    action: "file.delete",
    actorUserId: admin.id,
    campusId: file.campusId,
    entityId: file.id,
    entityType: "FileAsset",
    metadata: {
      bucket: file.bucket,
      contentType: file.contentType ?? null,
      objectKey: file.objectKey,
    },
    organizationId: file.organizationId,
    summary: `Deleted uploaded file ${file.originalName}.`,
  })

  try {
    await createS3Client().send(
      new DeleteObjectCommand({
        Bucket: file.bucket,
        Key: file.objectKey,
      })
    )
  } catch (error) {
    console.error("File storage object delete failed", {
      bucket: file.bucket,
      error: error instanceof Error ? error.message : String(error),
      fileId: file.id,
      objectKey: file.objectKey,
    })
  }

  revalidatePath("/admin/files")
  redirectWithMessage("deleteSuccess", `Deleted ${file.originalName}.`)
}

function redirectWithMessage(key: "deleteError" | "deleteSuccess", message: string): never {
  redirect(`/admin/files?${key}=${encodeURIComponent(message)}`)
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
