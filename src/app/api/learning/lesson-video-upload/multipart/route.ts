import { revalidatePath } from "next/cache"
import { UserRole } from "@prisma/client"
import {
  AbortMultipartUploadCommand, CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand, HeadObjectCommand, ListPartsCommand,
  S3Client, UploadPartCommand,
} from "@aws-sdk/client-s3"

import { getPrismaClient } from "@/lib/prisma"
import { writeAuditLog } from "@/modules/audit/service"
import { canManageClassSection, getCurrentUser } from "@/modules/auth/permissions"
import { MAX_LESSON_VIDEO_UPLOAD_BYTES } from "@/modules/learning/video-upload-service"
import { signVideoUploadTicket, verifyVideoUploadTicket, videoUploadPartSize, VIDEO_UPLOAD_CHUNK_BYTES, type VideoUploadTicket } from "@/modules/learning/video-upload-token"

export const runtime = "nodejs"

class UploadError extends Error {
  constructor(message: string, readonly status = 400) { super(message) }
}

function storage() {
  return new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? "us-east-1",
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "", secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "" },
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
  })
}

function secret() {
  const value = process.env.NEXTAUTH_SECRET
  if (!value) throw new UploadError("Video upload is not configured.", 503)
  return value
}

async function authorize(classSectionId: string) {
  const user = await getCurrentUser()
  if (!user) throw new UploadError("Your session expired. Log in and retry the upload.", 401)
  if (!user.roleAssignments.some((assignment) => assignment.role === UserRole.INSTRUCTOR || assignment.role === UserRole.HOMEROOM_TEACHER) || !(await canManageClassSection(user.id, classSectionId))) throw new UploadError("Forbidden", 403)
  return user
}

async function readTicket(token: string) {
  let ticket: VideoUploadTicket
  try { ticket = verifyVideoUploadTicket(token, secret()) }
  catch (error) { throw new UploadError(error instanceof Error ? error.message : "Invalid upload ticket.") }
  const user = await authorize(ticket.classSectionId)
  if (user.id !== ticket.userId) throw new UploadError("Forbidden", 403)
  return ticket
}

function failure(error: unknown) {
  if (error instanceof UploadError) return Response.json({ error: error.message }, { status: error.status })
  if (error instanceof SyntaxError) return Response.json({ error: "Invalid upload request." }, { status: 400 })
  console.error("Multipart video upload failed", { error: error instanceof Error ? error.message : String(error) })
  return Response.json({ error: "Video upload failed. Please retry." }, { status: 500 })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (body.operation === "start") {
      const classSectionId = String(body.classSectionId ?? "")
      const user = await authorize(classSectionId)
      const name = String(body.name ?? "").replace(/[\\/\x00-\x1f]/g, "-").slice(0, 255)
      const size = Number(body.size)
      if (!Number.isSafeInteger(size) || size <= 0 || size > MAX_LESSON_VIDEO_UPLOAD_BYTES) throw new UploadError("Video must be between 1 byte and 500MB.")
      const extension = name.split(".").pop()?.toLowerCase()
      const types: Record<string, string> = { mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime", m4v: "video/mp4" }
      const contentType = extension ? types[extension] : undefined
      if (!contentType) throw new UploadError("Upload an MP4, WebM, MOV, or M4V video file.")
      const bucket = process.env.S3_BUCKET_NAME ?? "lms-files"
      const key = `videos/${classSectionId}/${crypto.randomUUID()}-${name.replace(/[^a-zA-Z0-9._-]+/g, "-")}`
      const signingSecret = secret()
      const result = await storage().send(new CreateMultipartUploadCommand({ Bucket: bucket, Key: key, ContentType: contentType }))
      if (!result.UploadId) throw new Error("Storage did not create an upload.")
      const ticket: VideoUploadTicket = { userId: user.id, classSectionId, bucket, key, uploadId: result.UploadId, name, contentType, size, expiresAt: Date.now() + 4 * 60 * 60 * 1000 }
      return Response.json({ token: signVideoUploadTicket(ticket, signingSecret), chunkBytes: VIDEO_UPLOAD_CHUNK_BYTES })
    }
    if (body.operation !== "complete") throw new UploadError("Invalid upload operation.")
    const ticket = await readTicket(String(body.token ?? ""))
    const client = storage()
    const object = { Bucket: ticket.bucket, Key: ticket.key }
    const prisma = getPrismaClient()
    const existing = await prisma.fileAsset.findFirst({ where: { bucket: ticket.bucket, objectKey: ticket.key, uploadedById: ticket.userId } })
    if (existing) return Response.json({ fileAsset: { id: existing.id, label: existing.originalName } })
    try {
      const result = await client.send(new ListPartsCommand({ ...object, UploadId: ticket.uploadId }))
      const parts = result.Parts ?? []
      const count = Math.ceil(ticket.size / VIDEO_UPLOAD_CHUNK_BYTES)
      if (parts.length !== count || result.IsTruncated || parts.some((part, index) => part.PartNumber !== index + 1 || !part.ETag || part.Size !== videoUploadPartSize(ticket.size, index + 1))) throw new UploadError("Video upload is incomplete. Please retry.")
      await client.send(new CompleteMultipartUploadCommand({ ...object, UploadId: ticket.uploadId, MultipartUpload: { Parts: parts.map(({ PartNumber, ETag }) => ({ PartNumber, ETag })) } }))
    } catch (error) {
      // A completion response can be lost; the signed object can still be registered on retry.
      if (!(error instanceof Error) || error.name !== "NoSuchUpload") throw error
    }
    const head = await client.send(new HeadObjectCommand(object))
    if (head.ContentLength !== ticket.size || head.ContentType !== ticket.contentType) throw new UploadError("Uploaded video size does not match. Please retry.")
    const section = await prisma.classSection.findUniqueOrThrow({ where: { id: ticket.classSectionId }, select: { organizationId: true, campusId: true } })
    const asset = await prisma.fileAsset.create({ data: {
      ...section, classSectionId: ticket.classSectionId, uploadedById: ticket.userId,
      bucket: ticket.bucket, objectKey: ticket.key, originalName: ticket.name,
      contentType: ticket.contentType, byteSize: BigInt(ticket.size), visibility: "CLASS_SECTION",
      metadata: { source: "lesson-video-upload" },
    } })
    await writeAuditLog({ action: "file.upload", actorUserId: ticket.userId, ...section, entityId: asset.id, entityType: "FileAsset", metadata: { classSectionId: ticket.classSectionId, source: "lesson-video-upload" }, summary: `Uploaded lesson video ${ticket.name}.` })
    revalidatePath(`/instructor/classes/${ticket.classSectionId}`)
    return Response.json({ fileAsset: { id: asset.id, label: asset.originalName } })
  } catch (error) { return failure(error) }
}

export async function PUT(request: Request) {
  try {
    const token = request.headers.get("x-upload-token") ?? ""
    const ticket = await readTicket(token)
    const partNumber = Number(new URL(request.url).searchParams.get("part"))
    let expectedSize: number
    try { expectedSize = videoUploadPartSize(ticket.size, partNumber) }
    catch { throw new UploadError("Invalid video part.") }
    const declaredSize = Number(request.headers.get("content-length"))
    if (declaredSize > VIDEO_UPLOAD_CHUNK_BYTES) throw new UploadError("Video part is too large.", 413)
    // Bound memory even when the caller omits Content-Length.
    const reader = request.body?.getReader()
    if (!reader) throw new UploadError("Missing video part.")
    const buffers: Uint8Array[] = []
    let size = 0
    while (true) {
      const next = await reader.read()
      if (next.done) break
      size += next.value.byteLength
      if (size > expectedSize) { await reader.cancel(); throw new UploadError("Video part is too large.", 413) }
      buffers.push(next.value)
    }
    if (size !== expectedSize) throw new UploadError("Video part size does not match.")
    await storage().send(new UploadPartCommand({ Bucket: ticket.bucket, Key: ticket.key, UploadId: ticket.uploadId, PartNumber: partNumber, Body: Buffer.concat(buffers), ContentLength: size }))
    return Response.json({ ok: true })
  } catch (error) { return failure(error) }
}

export async function DELETE(request: Request) {
  try {
    const ticket = await readTicket(request.headers.get("x-upload-token") ?? "")
    await storage().send(new AbortMultipartUploadCommand({ Bucket: ticket.bucket, Key: ticket.key, UploadId: ticket.uploadId }))
    return Response.json({ ok: true })
  } catch (error) { return failure(error) }
}
