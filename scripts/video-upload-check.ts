import assert from "node:assert/strict"
import { test } from "node:test"
import { signVideoUploadTicket, verifyVideoUploadTicket, videoUploadPartSize, VIDEO_UPLOAD_CHUNK_BYTES, type VideoUploadTicket } from "../src/modules/learning/video-upload-token"
import { getVideoCompletion, readWatchedIntervals } from "../src/modules/learning/watch-intervals"

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
