import "server-only"

import { GetObjectCommand, PutObjectCommand, type S3Client } from "@aws-sdk/client-s3"
import sharp from "sharp"

export function thumbnailKey(fileId: string) {
  return `lms-thumbnails/v1/${fileId}.webp`
}

// Derivatives remain in private storage and are served only after file authorization.
export async function getFileThumbnail(client: S3Client, file: {
  id: string; bucket: string; objectKey: string; byteSize: bigint | null; contentType: string | null
}) {
  const limit = 10 * 1024 * 1024
  if (!/^image\/(png|jpeg|webp|gif)$/.test(file.contentType ?? "") ||
      !file.byteSize || file.byteSize > BigInt(limit)) return null
  const Key = thumbnailKey(file.id)
  try {
    return await client.send(new GetObjectCommand({ Bucket: file.bucket, Key }))
  } catch (error) {
    if (!(error instanceof Error) || !["NoSuchKey", "NotFound"].includes(error.name)) throw error
  }
  const original = await client.send(new GetObjectCommand({ Bucket: file.bucket, Key: file.objectKey }))
  if (!original.Body || !original.ContentLength || original.ContentLength > limit) {
    const body = original.Body
    if (body && "destroy" in body && typeof body.destroy === "function") body.destroy()
    return null
  }
  const buffer = await original.Body.transformToByteArray()
  const image = await sharp(buffer, { limitInputPixels: 25_000_000, animated: false })
    .rotate().resize(224, 224, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 }).timeout({ seconds: 5 }).toBuffer()
  await client.send(new PutObjectCommand({ Bucket: file.bucket, Key, Body: image, ContentType: "image/webp" }))
  return client.send(new GetObjectCommand({ Bucket: file.bucket, Key }))
}
