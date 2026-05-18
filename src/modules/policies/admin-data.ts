import "server-only"

import { getPrismaClient } from "@/lib/prisma"
import { getAdminData } from "@/modules/admin/data"
import { resolvePolicies } from "@/modules/policies/resolve"
import type {
  PolicyFormValue,
  SerializedGradingScale,
} from "@/modules/policies/types"

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
  const policyCampusOptions = admin.campuses.map((campus) => ({
    id: campus.id,
    organizationId: campus.organizationId,
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

  const serializedGradingScales: SerializedGradingScale[] = gradingScales.map(
    (scale) => ({
      id: scale.id,
      name: scale.name,
      description: scale.description,
      isDefault: scale.isDefault,
      items: scale.items.map((item) => ({
        id: item.id,
        label: item.label,
        minPercentage: item.minPercentage.toString(),
        maxPercentage: item.maxPercentage.toString(),
        gradePoint: item.gradePoint?.toString() ?? "0",
        isPassing: item.isPassing,
      })),
    })
  )
  const policyFormValue: PolicyFormValue | null = policies
    ? {
        attendance: policies.attendance,
        videoCompletion: policies.videoCompletion,
        assignment: policies.assignment,
        gradeVisibility: policies.gradeVisibility,
        document: policies.document,
        gpaScale: policies.gpaScale,
        gradingScale: null,
      }
    : null

  return {
    ...admin,
    policyCampusOptions,
    scopedCampusOptions: campusOptions,
    selectedOrganizationId: organizationId,
    selectedCampusId: campusId,
    policies,
    policyFormValue,
    gradingScales: serializedGradingScales,
  }
}
