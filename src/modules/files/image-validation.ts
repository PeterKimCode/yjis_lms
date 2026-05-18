import { sanitizeFileName } from "@/modules/files/upload-validation"

const MB = 1024 * 1024

export const imageUploadPolicy = {
  maxBytes: 10 * MB,
  maxPostImages: 5,
  maxCommentImages: 1,
  allowedMimeTypes: new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
  ]),
  allowedExtensions: new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]),
  blockedExtensions: new Set([
    ".exe",
    ".bat",
    ".cmd",
    ".ps1",
    ".sh",
    ".zip",
    ".rar",
    ".7z",
    ".html",
    ".js",
    ".svg",
    ".pdf",
    ".docx",
  ]),
}

export type ImageUploadValidation =
  | {
      ok: true
      contentType: string
      extension: string
      safeName: string
    }
  | {
      ok: false
      message: string
    }

export async function validateImageUpload(
  file: File
): Promise<ImageUploadValidation> {
  const safeName = sanitizeFileName(file.name)
  const extension = getFileExtension(safeName)

  if (file.size > imageUploadPolicy.maxBytes) {
    return {
      ok: false,
      message: "Image must be 10MB or smaller.",
    }
  }

  if (imageUploadPolicy.blockedExtensions.has(extension)) {
    return {
      ok: false,
      message: "This file type is not allowed.",
    }
  }

  if (
    !imageUploadPolicy.allowedExtensions.has(extension) ||
    !imageUploadPolicy.allowedMimeTypes.has(file.type)
  ) {
    return {
      ok: false,
      message: "Only JPG, PNG, WEBP, or GIF images are allowed.",
    }
  }

  if (!(await hasExpectedImageSignature(file, file.type))) {
    return {
      ok: false,
      message: "This file type is not allowed.",
    }
  }

  return {
    ok: true,
    contentType: file.type,
    extension,
    safeName,
  }
}

function getFileExtension(name: string) {
  const match = /\.[^.]+$/.exec(name.toLowerCase())

  return match?.[0] ?? ""
}

async function hasExpectedImageSignature(file: File, contentType: string) {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer())

  if (contentType === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  }

  if (contentType === "image/png") {
    return (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    )
  }

  if (contentType === "image/webp") {
    return (
      toAscii(bytes.slice(0, 4)) === "RIFF" &&
      toAscii(bytes.slice(8, 12)) === "WEBP"
    )
  }

  if (contentType === "image/gif") {
    const header = toAscii(bytes.slice(0, 6))

    return header === "GIF87a" || header === "GIF89a"
  }

  return false
}

function toAscii(bytes: Uint8Array) {
  return String.fromCharCode(...bytes)
}
