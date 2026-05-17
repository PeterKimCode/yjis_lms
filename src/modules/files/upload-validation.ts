const MB = 1024 * 1024

export const assignmentAttachmentPolicy = {
  maxBytes: 20 * MB,
  allowedExtensions: new Set([
    ".pdf",
    ".doc",
    ".docx",
    ".ppt",
    ".pptx",
    ".xls",
    ".xlsx",
    ".txt",
    ".md",
    ".csv",
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".gif",
    ".zip",
  ]),
  allowedMimeTypes: new Set([
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
    "text/markdown",
    "text/csv",
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
    "application/zip",
    "application/x-zip-compressed",
  ]),
  blockedExtensions: new Set([
    ".exe",
    ".bat",
    ".cmd",
    ".com",
    ".scr",
    ".ps1",
    ".vbs",
    ".js",
    ".mjs",
    ".cjs",
    ".jar",
    ".msi",
    ".dll",
    ".sh",
    ".php",
    ".py",
    ".rb",
    ".pl",
    ".html",
    ".htm",
    ".svg",
    ".sql",
  ]),
}

export function validateAssignmentAttachment(file: File) {
  const safeName = sanitizeFileName(file.name)
  const extension = getFileExtension(safeName)

  if (file.size > assignmentAttachmentPolicy.maxBytes) {
    return {
      ok: false as const,
      message: "File is too large. Maximum size is 20 MB.",
    }
  }

  if (assignmentAttachmentPolicy.blockedExtensions.has(extension)) {
    return {
      ok: false as const,
      message: "Executable or script files are not allowed.",
    }
  }

  if (!assignmentAttachmentPolicy.allowedExtensions.has(extension)) {
    return {
      ok: false as const,
      message: "This file type is not allowed.",
    }
  }

  if (
    file.type &&
    file.type !== "application/octet-stream" &&
    !assignmentAttachmentPolicy.allowedMimeTypes.has(file.type)
  ) {
    return {
      ok: false as const,
      message: "This file type is not allowed.",
    }
  }

  return {
    ok: true as const,
    safeName,
    extension,
    contentType: file.type || "application/octet-stream",
  }
}

export function sanitizeFileName(name: string) {
  const withoutPath = name.replace(/[/\\:]+/g, "-")
  const withoutControls = withoutPath.replace(/[\u0000-\u001f\u007f]/g, "")
  const normalized = withoutControls.trim().replace(/\s+/g, " ")
  const fallback = normalized || "attachment"

  return fallback.slice(0, 140)
}

function getFileExtension(name: string) {
  const match = /\.[^.]+$/.exec(name.toLowerCase())

  return match?.[0] ?? ""
}
