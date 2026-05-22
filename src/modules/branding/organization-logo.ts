import "server-only"

import { getPrismaClient } from "@/lib/prisma"

const defaultLogoUrl = "/brand/gtcc-logo.png"

export async function getOrganizationLogoUrl(organizationId: string | null | undefined) {
  if (!organizationId) return defaultLogoUrl

  const organization = await getPrismaClient().organization.findUnique({
    where: { id: organizationId },
    select: {
      logoFileAsset: {
        select: { id: true },
      },
    },
  })

  return organization?.logoFileAsset
    ? `/api/files/${organization.logoFileAsset.id}/download?disposition=inline`
    : defaultLogoUrl
}
