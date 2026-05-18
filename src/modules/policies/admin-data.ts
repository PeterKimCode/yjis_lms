import "server-only"

import { getPrismaClient } from "@/lib/prisma"
import { getAdminData } from "@/modules/admin/data"
import { resolvePolicies } from "@/modules/policies/resolve"

export async function getPolicyAdminData(input: {
  campusId?: string | null
  organizationId?: string | null
} = {}) {
  const admin = await getAdminData()
  const requestedOrganization = admin.organizations.find(
    (organization) => organization.id === input.organizationId
  )
  const organizationId =
    requestedOrganization?.id ?? admin.organizations[0]?.id ?? null
  const campusOptions = admin.campuses
    .filter((campus) => !organizationId || campus.organizationId === organizationId)
    .map((campus) => ({
      id: campus.id,
      label: `${campus.name} (${campus.organization.name})`,
    }))
  const campusId =
    campusOptions.find((campus) => campus.id === input.campusId)?.id ?? null
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
    scopedCampusOptions: campusOptions,
    selectedOrganizationId: organizationId,
    selectedCampusId: campusId,
    policies,
    gradingScales,
  }
}
