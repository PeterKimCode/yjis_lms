import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { NextResponse } from "next/server"

import { getPrismaClient } from "@/lib/prisma"
import { canViewClassSection } from "@/modules/auth/permissions"
import { getCurrentSession } from "@/modules/auth/session"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ fileId: string }> }
) {
  const session = await getCurrentSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { fileId } = await params
  const file = await getPrismaClient().fileAsset.findUnique({
    where: { id: fileId },
    select: {
      bucket: true,
      objectKey: true,
      classSectionId: true,
    },
  })

  if (!file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  if (
    file.classSectionId &&
    !(await canViewClassSection(session.user.id, file.classSectionId))
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const url = await getSignedUrl(
    createS3Client(),
    new GetObjectCommand({
      Bucket: file.bucket,
      Key: file.objectKey,
    }),
    { expiresIn: 300 }
  )

  return NextResponse.redirect(url)
}

function createS3Client() {
  return new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? "us-east-1",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
    },
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
  })
}
