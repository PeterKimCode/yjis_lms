import assert from "node:assert/strict"
import { test } from "node:test"
import { signVideoUploadTicket, verifyVideoUploadTicket, videoUploadPartSize, VIDEO_UPLOAD_CHUNK_BYTES, type VideoUploadTicket } from "../src/modules/learning/video-upload-token"
import { getVideoCompletion, readWatchedIntervals } from "../src/modules/learning/watch-intervals"
import { uploadVideoInParts } from "../src/modules/learning/upload-video"

const ticket: VideoUploadTicket = { userId: "teacher", classSectionId: "class-1", bucket: "private", key: "videos/class-1/video.mp4", uploadId: "upload-1", name: "video.mp4", contentType: "video/mp4", size: 150 * 1024 * 1024, expiresAt: 5000 }

test("upload ticket rejects tampering, another secret and expiration", () => {
  const token = signVideoUploadTicket(ticket, "secret")
  assert.deepEqual(verifyVideoUploadTicket(token, "secret", 1000), ticket)
  assert.throws(() => verifyVideoUploadTicket(token, "another-secret", 1000))
  const payload = Buffer.from(JSON.stringify({ ...ticket, classSectionId: "another-class" })).toString("base64url")
  assert.throws(() => verifyVideoUploadTicket(`${payload}.${token.split(".")[1]}`, "secret", 1000))
  assert.throws(() => verifyVideoUploadTicket(token, "secret", 5000))
})

test("150MB and 500MB videos use bounded parts with an exact final remainder", () => {
  for (const size of [1, VIDEO_UPLOAD_CHUNK_BYTES, VIDEO_UPLOAD_CHUNK_BYTES + 1, 150 * 1024 * 1024, 500 * 1024 * 1024]) {
    const count = Math.ceil(size / VIDEO_UPLOAD_CHUNK_BYTES)
    const parts = Array.from({ length: count }, (_, index) => videoUploadPartSize(size, index + 1))
    assert.equal(parts.reduce((total, value) => total + value, 0), size)
    assert.ok(parts.every((value) => value > 0 && value <= VIDEO_UPLOAD_CHUNK_BYTES))
    assert.throws(() => videoUploadPartSize(size, count + 1))
    assert.throws(() => videoUploadPartSize(size, 0))
    assert.throws(() => videoUploadPartSize(size, 1.5))
  }
})

test("video completion requires 100 percent and a known duration", () => {
  assert.equal(getVideoCompletion([{ start: 0, end: 90 }], 100).completed, false)
  assert.equal(getVideoCompletion([{ start: 0, end: 99 }], 100).completed, false)
  assert.equal(getVideoCompletion([{ start: 0, end: 100 }], 100).completed, true)
  const unknown = getVideoCompletion([{ start: 0, end: 40 }], 0)
  assert.equal(unknown.completed, false)
  assert.equal(unknown.watchedSeconds, 40)
})

test("resuming merges persisted intervals, without counting replayed or skipped spans", () => {
  const history = readWatchedIntervals([{ start: 0, end: 50 }])
  const replay = getVideoCompletion([...history, { start: 0, end: 50 }], 100)
  assert.equal(replay.watchedSeconds, 50)
  assert.equal(replay.completed, false)
  const skipped = getVideoCompletion([...history, { start: 90, end: 100 }], 100)
  assert.equal(skipped.watchedSeconds, 60)
  assert.equal(skipped.completed, false)
  const resumed = getVideoCompletion([...history, { start: 50, end: 100 }], 100)
  assert.equal(resumed.completed, true)
  assert.equal(resumed.progressRate, 100)
  assert.deepEqual(readWatchedIntervals(null, 40), [{ start: 0, end: 40 }])
})

test("client retries a failed part and reports 100 only after registration", async () => {
  const originalFetch = globalThis.fetch
  const originalXHR = globalThis.XMLHttpRequest
  const sizes: number[] = []
  const progress: number[] = []
  let failures = 1
  let completed = false
  class Request {
    status = 200
    responseText = "{}"
    timeout = 0
    upload = { onprogress: null as ((event: { loaded: number }) => void) | null }
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    onabort: (() => void) | null = null
    open() {}
    setRequestHeader() {}
    abort() { this.onabort?.() }
    send(blob: Blob) {
      sizes.push(blob.size)
      this.upload.onprogress?.({ loaded: blob.size })
      if (failures-- > 0) this.onerror?.()
      else this.onload?.()
    }
  }
  globalThis.XMLHttpRequest = Request as unknown as typeof XMLHttpRequest
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(String(options?.body))
    if (body.operation === "start") return Response.json({ token: "signed-token", chunkBytes: VIDEO_UPLOAD_CHUNK_BYTES })
    assert.equal(body.operation, "complete")
    assert.ok(progress.every((value) => value < 100))
    completed = true
    return Response.json({ fileAsset: { id: "file-1", label: "video.mp4" } })
  }
  try {
    const file = new File([new Uint8Array(10 * 1024 * 1024)], "video.mp4")
    const result = await uploadVideoInParts(file, "class-1", new AbortController().signal, (value) => progress.push(value))
    assert.deepEqual(sizes, [VIDEO_UPLOAD_CHUNK_BYTES, VIDEO_UPLOAD_CHUNK_BYTES, 2 * 1024 * 1024])
    assert.equal(result.id, "file-1")
    assert.equal(completed, true)
    assert.equal(progress.at(-1), 100)
  } finally {
    globalThis.fetch = originalFetch
    globalThis.XMLHttpRequest = originalXHR
  }
})

test("canceling a client upload aborts the signed storage upload", async () => {
  const originalFetch = globalThis.fetch
  const controller = new AbortController()
  const methods: string[] = []
  globalThis.fetch = async (_url, options) => {
    methods.push(String(options?.method))
    if (options?.method === "POST") controller.abort()
    return Response.json({ token: "signed-token", chunkBytes: VIDEO_UPLOAD_CHUNK_BYTES })
  }
  try {
    await assert.rejects(uploadVideoInParts(new File(["video"], "video.mp4"), "class-1", controller.signal, () => undefined), { name: "AbortError" })
    assert.deepEqual(methods, ["POST", "DELETE"])
  } finally { globalThis.fetch = originalFetch }
})
