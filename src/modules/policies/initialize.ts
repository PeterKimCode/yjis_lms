import { Prisma, type PrismaClient } from "@prisma/client"

import { getPrismaClient } from "../../lib/prisma"
import {
  DEFAULT_ASSIGNMENT_POLICY,
  DEFAULT_ATTENDANCE_POLICY,
  DEFAULT_DOCUMENT_POLICY,
  DEFAULT_GPA_SCALE,
  DEFAULT_GRADE_VISIBILITY_POLICY,
  DEFAULT_GRADING_SCALE_DESCRIPTION,
  DEFAULT_GRADING_SCALE_ITEMS,
  DEFAULT_GRADING_SCALE_NAME,
  DEFAULT_VIDEO_COMPLETION_POLICY,
  POLICY_NAMES,
} from "./defaults"

type PrismaLike = PrismaClient | Prisma.TransactionClient

type PolicyScope = {
  organizationId: string
  campusId?: string | null
}

export async function ensureDefaultPoliciesForOrganization(
  scope: Pick<PolicyScope, "organizationId">,
  prisma: PrismaLike = getPrismaClient()
) {
  await ensureDefaultPoliciesForScope(
    { organizationId: scope.organizationId, campusId: null },
    prisma
  )
  await ensureDefaultGradingScaleForOrganization(scope, prisma)
}

export async function ensureDefaultPoliciesForCampus(
  scope: Required<PolicyScope>,
  prisma: PrismaLike = getPrismaClient()
) {
  await ensureDefaultPoliciesForScope(scope, prisma)
  await ensureDefaultGradingScaleForCampus(scope, prisma)
}

export async function ensureDefaultGradingScaleForCampus(
  scope: Required<PolicyScope>,
  prisma: PrismaLike = getPrismaClient()
) {
  // GradingScale is organization-scoped in the current schema, so campuses
  // inherit the organization's default scale.
  await ensureDefaultGradingScaleForOrganization(
    { organizationId: scope.organizationId },
    prisma
  )
}

export async function ensureDefaultGradingScaleForOrganization(
  scope: Pick<PolicyScope, "organizationId">,
  prisma: PrismaLike = getPrismaClient()
) {
  const existing = await prisma.gradingScale.findFirst({
    where: {
      organizationId: scope.organizationId,
      name: DEFAULT_GRADING_SCALE_NAME,
    },
    include: { items: true },
  })

  const scale =
    existing ??
    (await prisma.gradingScale.create({
      data: {
        organizationId: scope.organizationId,
        name: DEFAULT_GRADING_SCALE_NAME,
        description: DEFAULT_GRADING_SCALE_DESCRIPTION,
        isDefault: true,
      },
      include: { items: true },
    }))

  if (
    scale.description !== DEFAULT_GRADING_SCALE_DESCRIPTION ||
    !scale.isDefault
  ) {
    await prisma.gradingScale.update({
      where: { id: scale.id },
      data: {
        description: DEFAULT_GRADING_SCALE_DESCRIPTION,
        isDefault: true,
      },
    })
  }

  for (const item of DEFAULT_GRADING_SCALE_ITEMS) {
    const existingItem = scale.items.find(
      (row) => row.label === item.label
    )
    const values = {
      minPercentage: new Prisma.Decimal(item.minPercentage),
      maxPercentage: new Prisma.Decimal(item.maxPercentage),
      gradePoint: new Prisma.Decimal(item.gradePoint),
      isPassing: item.isPassing,
    }

    if (existingItem) {
      await prisma.gradingScaleItem.update({
        where: { id: existingItem.id },
        data: values,
      })
    } else {
      await prisma.gradingScaleItem.create({
        data: {
          gradingScaleId: scale.id,
          label: item.label,
          ...values,
        },
      })
    }
  }
}

async function ensureDefaultPoliciesForScope(
  scope: PolicyScope,
  prisma: PrismaLike
) {
  await ensureAcademicPolicy(scope, prisma)
  await ensureAttendancePolicy(scope, prisma)
  await ensureVideoCompletionPolicy(scope, prisma)
  await ensureGradingPolicy(scope, prisma)
}

async function ensureAcademicPolicy(scope: PolicyScope, prisma: PrismaLike) {
  const existing = await prisma.academicPolicy.findFirst({
    where: scopedWhere(scope, POLICY_NAMES.academic),
    select: { id: true },
  })

  if (existing) return

  await prisma.academicPolicy.create({
    data: {
      ...scope,
      campusId: scope.campusId ?? null,
      classSectionId: null,
      name: POLICY_NAMES.academic,
      settings: {
        academicCalendar: "semester",
        supportsK12ReportCards: true,
        supportsUniversityTranscripts: true,
      },
    },
  })
}

async function ensureAttendancePolicy(scope: PolicyScope, prisma: PrismaLike) {
  const existing = await prisma.attendancePolicy.findFirst({
    where: scopedWhere(scope, POLICY_NAMES.attendance),
    select: { id: true },
  })

  if (existing) return

  await prisma.attendancePolicy.create({
    data: {
      ...scope,
      campusId: scope.campusId ?? null,
      classSectionId: null,
      name: POLICY_NAMES.attendance,
      lateAfterMinutes: DEFAULT_ATTENDANCE_POLICY.lateThresholdMinutes,
      absenceAfterMinutes: null,
      settings: DEFAULT_ATTENDANCE_POLICY,
    },
  })
}

async function ensureVideoCompletionPolicy(
  scope: PolicyScope,
  prisma: PrismaLike
) {
  const existing = await prisma.videoCompletionPolicy.findFirst({
    where: scopedWhere(scope, POLICY_NAMES.videoCompletion),
    select: { id: true },
  })

  if (existing) return

  await prisma.videoCompletionPolicy.create({
    data: {
      ...scope,
      campusId: scope.campusId ?? null,
      classSectionId: null,
      name: POLICY_NAMES.videoCompletion,
      requiredPercentage: new Prisma.Decimal(
        DEFAULT_VIDEO_COMPLETION_POLICY.completionThresholdPercent
      ),
      settings: {
        completionRate:
          DEFAULT_VIDEO_COMPLETION_POLICY.completionThresholdPercent,
        ...DEFAULT_VIDEO_COMPLETION_POLICY,
      },
    },
  })
}

async function ensureGradingPolicy(scope: PolicyScope, prisma: PrismaLike) {
  const existing = await prisma.gradingPolicy.findFirst({
    where: scopedWhere(scope, POLICY_NAMES.grading),
    select: { id: true },
  })

  if (existing) return

  await prisma.gradingPolicy.create({
    data: {
      ...scope,
      campusId: scope.campusId ?? null,
      classSectionId: null,
      name: POLICY_NAMES.grading,
      gpaScale: new Prisma.Decimal(DEFAULT_GPA_SCALE),
      settings: {
        ...DEFAULT_ASSIGNMENT_POLICY,
        ...DEFAULT_GRADE_VISIBILITY_POLICY,
        ...DEFAULT_DOCUMENT_POLICY,
      },
    },
  })
}

function scopedWhere(scope: PolicyScope, name: string) {
  return {
    organizationId: scope.organizationId,
    campusId: scope.campusId ?? null,
    classSectionId: null,
    name,
  }
}
