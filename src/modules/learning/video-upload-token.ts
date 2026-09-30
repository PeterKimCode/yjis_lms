import { createHmac, timingSafeEqual } from "node:crypto"

export const VIDEO_UPLOAD_CHUNK_BYTES = 8 * 1024 * 1024
export type VideoUploadTicket = {
  userId: string
  classSectionId: string
  bucket: string
  key: string
  uploadId: string
  name: string
  contentType: string
  size: number
  expiresAt: number
}

export function signVideoUploadTicket(ticket: VideoUploadTicket, secret: string) {
  const payload = Buffer.from(JSON.stringify(ticket)).toString("base64url")
  const signature = createHmac("sha256", secret).update(payload).digest("base64url")
  return `${payload}.${signature}`
}

export function verifyVideoUploadTicket(token: string, secret: string, now = Date.now()): VideoUploadTicket {
  const [payload, signature, extra] = token.split(".")
  if (!payload || !signature || extra) throw new Error("Invalid upload ticket.")
  const expected = createHmac("sha256", secret).update(payload).digest()
  const received = Buffer.from(signature, "base64url")
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) throw new Error("Invalid upload ticket.")
  const ticket = JSON.parse(Buffer.from(payload, "base64url").toString()) as VideoUploadTicket
  if (!Number.isFinite(ticket.expiresAt) || ticket.expiresAt <= now) throw new Error("Upload expired. Please start again.")
  return ticket
}

export function videoUploadPartSize(size: number, partNumber: number) {
  const count = Math.ceil(size / VIDEO_UPLOAD_CHUNK_BYTES)
  if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > count) throw new Error("Invalid video part.")
  return Math.min(VIDEO_UPLOAD_CHUNK_BYTES, size - (partNumber - 1) * VIDEO_UPLOAD_CHUNK_BYTES)
}
