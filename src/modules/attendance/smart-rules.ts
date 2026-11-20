import { createHash, createHmac, timingSafeEqual } from "node:crypto"
import { AttendanceStatus } from "@prisma/client"
import { qrPrefix } from "./smart-shared"

const rotationMs = 12_000
const reviewMs = 45_000
const digestPattern = /^[A-Za-z0-9_-]{43}$/
export function isQrOpen(
  session: { qrOpenedAt: Date | null; qrClosesAt: Date | null; qrFinalizedAt: Date | null },
  now: Date
) {
  return Boolean(session.qrOpenedAt && session.qrClosesAt && !session.qrFinalizedAt &&
    session.qrOpenedAt <= now && now < session.qrClosesAt)
}

export function suggestedStatus(verifiedAt: Date | null, lateAt: Date | null) {
  if (!verifiedAt) return AttendanceStatus.ABSENT
  return lateAt && verifiedAt >= lateAt ? AttendanceStatus.LATE : AttendanceStatus.PRESENT
}

function sign(secret: string, fields: (string | number)[]) {
  return createHmac("sha256", secret).update(JSON.stringify(fields)).digest("base64url")
}

export function issueTicket(secret: string, sessionId: string, studentId: string, now: number) {
  const expiresAt = (Math.floor(now / rotationMs) + 1) * rotationMs
  return { code: qrPrefix + sign(secret, ["qr", sessionId, studentId, expiresAt]), expiresAt }
}

export function ticketHash(value: string) {
  const code = value.slice(qrPrefix.length)
  if (!value.startsWith(qrPrefix) || !digestPattern.test(code)) return null
  return createHash("sha256").update(code).digest("hex")
}

export function issueReview(secret: string, sessionId: string, studentId: string, actorId: string, now: number) {
  return now + "." + sign(secret, ["review", sessionId, studentId, actorId, now])
}

export function readReview(
  secret: string, receipt: string, sessionId: string, studentId: string, actorId: string, now: number
) {
  const [stamp, signature, extra] = receipt.split(".")
  const scannedAt = Number(stamp)
  if (extra !== undefined || !Number.isSafeInteger(scannedAt) ||
      scannedAt > now || now - scannedAt >= reviewMs || !signature || !digestPattern.test(signature)) {
    return null
  }
  const expected = sign(secret, ["review", sessionId, studentId, actorId, scannedAt])
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected)) ? new Date(scannedAt) : null
}
