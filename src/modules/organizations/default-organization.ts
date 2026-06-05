import "server-only"

import { InstitutionType, type Prisma, type PrismaClient } from "@prisma/client"

import { getPrismaClient } from "@/lib/prisma"

export const fallbackOrganizationSlug = "default-organization"

type PrismaLike = PrismaClient | Prisma.TransactionClient | ReturnType<typeof getPrismaClient>

export async function ensureDefaultOrganization(prisma: PrismaLike = getPrismaClient()) {
  const existing = await prisma.organization.findFirst({
    where: {
      OR: [{ slug: fallbackOrganizationSlug }, { isActive: true }],
    },
    orderBy: [{ slug: "asc" }, { createdAt: "asc" }],
  })

  if (existing) return existing

  return prisma.organization.create({
    data: {
      name: "Default Organization",
      slug: fallbackOrganizationSlug,
      institutionType: InstitutionType.ONLINE_SCHOOL,
      isActive: true,
    },
  })
}
