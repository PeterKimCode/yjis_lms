import "server-only"

import { getPrismaClient } from "@/lib/prisma"

const defaultLogoUrl = "/brand/gtcc-logo.png"

export async function getOrganizationLogoUrl(organizationId: string | null | undefined) {
  if (!organizationId) return defaultLogoUrl

  const rows = await getPrismaClient().$queryRaw<
    Array<{ logoFileAssetId: string | null }>
  >`SELECT "logoFileAssetId" FROM "Organization" WHERE "id" = ${organizationId} LIMIT 1`

  return rows[0]?.logoFileAssetId
    ? `/api/files/${rows[0].logoFileAssetId}/download?disposition=inline`
    : defaultLogoUrl
}
