import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getPrismaClient } from "@/lib/prisma"
export async function GET(_: Request, { params }: { params: Promise<{ organizationId: string }> }) {
  const { organizationId } = await params
  const organization = await getPrismaClient().organization.findFirst({ where: { id: organizationId, isActive: true, showOnLogin: true }, select: { logoFileAsset: { select: { bucket: true, objectKey: true, contentType: true, byteSize: true } } } })
  const file = organization?.logoFileAsset
  if (!file || !file.contentType || !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.contentType) || Number(file.byteSize) > 10 * 1024 * 1024) return new Response(null, { status: 404 })
  try {
    const s3 = new S3Client({ endpoint: process.env.S3_ENDPOINT, region: process.env.S3_REGION ?? "us-east-1", credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "", secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "" }, forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false" })
    const result = await s3.send(new GetObjectCommand({ Bucket: file.bucket, Key: file.objectKey }))
    if (!result.Body) return new Response(null, { status: 404 })
    return new Response(new Uint8Array(await result.Body.transformToByteArray()), { headers: { "Content-Type": file.contentType, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; sandbox" } })
  } catch { return new Response(null, { status: 404 }) }
}
