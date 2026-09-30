const endpoint = "/api/learning/lesson-video-upload/multipart"

type UploadResponse = { error?: string; token?: string; chunkBytes?: number; fileAsset?: { id: string; label: string } }

async function jsonResponse(response: Response): Promise<UploadResponse> {
  const body = await response.json().catch(() => ({})) as UploadResponse
  if (!response.ok) throw new Error(body.error ?? `Video upload failed (HTTP ${response.status}).`)
  return body
}

function sendPart(token: string, part: number, blob: Blob, signal: AbortSignal, progress: (bytes: number) => void) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException("Upload canceled.", "AbortError")); return }
    const request = new XMLHttpRequest()
    const abort = () => request.abort()
    const finish = () => signal.removeEventListener("abort", abort)
    request.open("PUT", `${endpoint}?part=${part}`)
    request.setRequestHeader("x-upload-token", token)
    request.timeout = 120_000
    request.upload.onprogress = (event) => progress(event.loaded)
    request.onload = () => {
      finish()
      if (request.status >= 200 && request.status < 300) { resolve(); return }
      let message = `Video upload failed (HTTP ${request.status}).`
      try { message = (JSON.parse(request.responseText) as UploadResponse).error ?? message } catch { /* Proxy errors may be HTML. */ }
      reject(new Error(message))
    }
    request.onerror = request.ontimeout = () => { finish(); reject(new Error("Connection interrupted. Please retry the upload.")) }
    request.onabort = () => { finish(); reject(new DOMException("Upload canceled.", "AbortError")) }
    signal.addEventListener("abort", abort, { once: true })
    request.send(blob)
  })
}

export async function uploadVideoInParts(file: File, classSectionId: string, signal: AbortSignal, progress: (percent: number) => void) {
  if (!/\.(mp4|webm|mov|m4v)$/i.test(file.name)) throw new Error("Upload an MP4, WebM, MOV, or M4V video file.")
  if (file.size <= 0 || file.size > 500 * 1024 * 1024) throw new Error("Video must be between 1 byte and 500MB.")
  let token: string | undefined
  try {
    const started = await jsonResponse(await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation: "start", classSectionId, name: file.name, size: file.size }), signal }))
    token = started.token
    if (!token || !started.chunkBytes) throw new Error("Video upload could not start.")
    const chunkBytes = started.chunkBytes
    for (let offset = 0, part = 1; offset < file.size; offset += chunkBytes, part++) {
      const chunk = file.slice(offset, offset + chunkBytes)
      for (let attempt = 0; ; attempt++) {
        try {
          await sendPart(token, part, chunk, signal, (bytes) => progress(Math.min(99, Math.floor((offset + Math.min(bytes, chunk.size)) / file.size * 100))))
          break
        } catch (error) {
          if (signal.aborted || attempt >= 2) throw error
        }
      }
    }
    // Retrying completion registers the same signed object if the first response was lost.
    for (let attempt = 0; ; attempt++) {
      try {
        const completed = await jsonResponse(await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation: "complete", token }), signal }))
        if (!completed.fileAsset) throw new Error("Video upload could not finish.")
        progress(100)
        return completed.fileAsset
      } catch (error) {
        if (signal.aborted || attempt >= 2) throw error
      }
    }
  } catch (error) {
    if (token) void fetch(endpoint, { method: "DELETE", headers: { "x-upload-token": token }, keepalive: true }).catch(() => undefined)
    throw error
  }
}
