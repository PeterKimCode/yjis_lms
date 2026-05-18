import "server-only"

import { getPrismaClient } from "@/lib/prisma"
import { getAdminData } from "@/modules/admin/data"
import { resolvePolicies } from "@/modules/policies/resolve"

export async function getPolicyAdminData() {
  const admin = await getAdminData()
  const organizationId = admin.organizations[0]?.id ?? null
  const campusId = admin.campuses[0]?.id ?? null
  const policies = organizationId
    ? await resolvePolicies({ organizationId, campusId })
    : null
  const gradingScales = organizationId
    ? await getPrismaClient().gradingScale.findMany({
        where: { organizationId },
        include: {
          items: {
            orderBy: { minPercentage: "desc" },
          },
        },
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      })
    : []

  return {
    ...admin,
    selectedOrganizationId: organizationId,
    selectedCampusId: campusId,
    policies,
    gradingScales,
  }
}

