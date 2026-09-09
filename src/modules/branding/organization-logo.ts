import "server-only"
import { cache } from "react"

import { getPrismaClient } from "@/lib/prisma"

const defaultLogoUrl = "/brand/gtcc-logo.png"

export const getOrganizationLogoUrl = cache(async (organizationId: string | null | undefined) => {
  if (!organizationId) return defaultLogoUrl

  const rows = await getPrismaClient().$queryRaw<
    Array<{ logoFileAssetId: string | null }>
  >`SELECT "logoFileAssetId" FROM "Organization" WHERE "id" = ${organizationId} LIMIT 1`

  return rows[0]?.logoFileAssetId
    ? `/api/files/${rows[0].logoFileAssetId}/download?disposition=inline&thumbnail=1`
    : defaultLogoUrl
})
