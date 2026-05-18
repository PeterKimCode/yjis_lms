import "server-only"

import type { Prisma } from "@prisma/client"

import { getPrismaClient } from "@/lib/prisma"
import {
  DEFAULT_ASSIGNMENT_POLICY,
  DEFAULT_ATTENDANCE_POLICY,
  DEFAULT_DOCUMENT_POLICY,
  DEFAULT_GRADE_VISIBILITY_POLICY,
  DEFAULT_VIDEO_COMPLETION_POLICY,
} from "@/modules/policies/defaults"
import type { ResolvedPolicies } from "@/modules/policies/types"

type PolicyContext = {
  organizationId: string
  campusId?: string | null
  classSectionId?: string | null
}

type AttendancePolicyRecord = {
  lateAfterMinutes: number | null
  absenceAfterMinutes: number | null
  settings: Prisma.JsonValue | null
} | null

type VideoPolicyRecord = {
  requiredPercentage: Prisma.Decimal
  settings: Prisma.JsonValue | null
} | null

type GradingPolicyRecord = {
  gpaScale: Prisma.Decimal | null
  settings: Prisma.JsonValue | null
} | null

export async function resolvePolicies(
  context: PolicyContext
): Promise<ResolvedPolicies> {
  const prisma = getPrismaClient()
  const [attendancePolicy, videoPolicy, gradingPolicy, gradingScale] =
    await Promise.all([
      findScopedPolicy(context, (where) =>
        prisma.attendancePolicy.findFirst({
          where,
          orderBy: { createdAt: "desc" },
          select: {
            lateAfterMinutes: true,
            absenceAfterMinutes: true,
            settings: true,
          },
        })
      ),
      findScopedPolicy(context, (where) =>
        prisma.videoCompletionPolicy.findFirst({
          where,
          orderBy: { createdAt: "desc" },
          select: {
            requiredPercentage: true,
            settings: true,
          },
        })
      ),
      findScopedPolicy(context, (where) =>
        prisma.gradingPolicy.findFirst({
          where,
          orderBy: { createdAt: "desc" },
          select: {
            gpaScale: true,
            settings: true,
          },
        })
      ),
      prisma.gradingScale.findFirst({
        where: { organizationId: context.organizationId },
        include: { items: { orderBy: { minPercentage: "desc" } } },
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      }),
    ])

  return {
    attendance: normalizeAttendancePolicy(attendancePolicy),
    videoCompletion: normalizeVideoCompletionPolicy(videoPolicy),
    assignment: normalizeAssignmentPolicy(gradingPolicy),
    gradeVisibility: normalizeGradeVisibilityPolicy(gradingPolicy),
    document: normalizeDocumentPolicy(gradingPolicy),
    gpaScale: gradingPolicy?.gpaScale?.toString() ?? "4.50",
    gradingScale,
  }
}

export function normalizeAttendancePolicy(policy?: AttendancePolicyRecord) {
  const settings = getObjectSettings(policy?.settings)

  return {
    ...DEFAULT_ATTENDANCE_POLICY,
    lateThresholdMinutes: toNumber(
      settings.lateThresholdMinutes,
      policy?.lateAfterMinutes ?? DEFAULT_ATTENDANCE_POLICY.lateThresholdMinutes
    ),
    absenceFailThresholdRate: toNullableNumber(
      settings.absenceFailThresholdRate,
      DEFAULT_ATTENDANCE_POLICY.absenceFailThresholdRate
    ),
    countLateAsAbsence: toBoolean(
      settings.countLateAsAbsence,
      DEFAULT_ATTENDANCE_POLICY.countLateAsAbsence
    ),
    lateEquivalentAbsenceCount: toNumber(
      settings.lateEquivalentAbsenceCount,
      DEFAULT_ATTENDANCE_POLICY.lateEquivalentAbsenceCount
    ),
    excusedCountsAsPresent: toBoolean(
      settings.excusedCountsAsPresent,
      DEFAULT_ATTENDANCE_POLICY.excusedCountsAsPresent
    ),
    excusedCountsAgainstAttendance: toBoolean(
      settings.excusedCountsAgainstAttendance,
      DEFAULT_ATTENDANCE_POLICY.excusedCountsAgainstAttendance
    ),
    allowInstructorOverride: toBoolean(
      settings.allowInstructorOverride,
      DEFAULT_ATTENDANCE_POLICY.allowInstructorOverride
    ),
  }
}

export function normalizeVideoCompletionPolicy(policy?: VideoPolicyRecord) {
  const settings = getObjectSettings(policy?.settings)

  return {
    ...DEFAULT_VIDEO_COMPLETION_POLICY,
    completionThresholdPercent: toNumber(
      settings.completionThresholdPercent ?? settings.completionRate,
      Number(policy?.requiredPercentage ?? DEFAULT_VIDEO_COMPLETION_POLICY.completionThresholdPercent)
    ),
    minimumWatchSeconds: toNullableNumber(
      settings.minimumWatchSeconds,
      DEFAULT_VIDEO_COMPLETION_POLICY.minimumWatchSeconds
    ),
    requireActualWatchedCoverage: toBoolean(
      settings.requireActualWatchedCoverage,
      DEFAULT_VIDEO_COMPLETION_POLICY.requireActualWatchedCoverage
    ),
  }
}

export function normalizeAssignmentPolicy(policy?: GradingPolicyRecord) {
  const settings = getObjectSettings(policy?.settings)

  return {
    ...DEFAULT_ASSIGNMENT_POLICY,
    allowLateSubmissionDefault: toBoolean(
      settings.allowLateSubmissionDefault,
      DEFAULT_ASSIGNMENT_POLICY.allowLateSubmissionDefault
    ),
    allowResubmissionBeforeDue: toBoolean(
      settings.allowResubmissionBeforeDue,
      DEFAULT_ASSIGNMENT_POLICY.allowResubmissionBeforeDue
    ),
    latePenaltyPercent: toNumber(
      settings.latePenaltyPercent,
      DEFAULT_ASSIGNMENT_POLICY.latePenaltyPercent
    ),
    maxLateDays: toNullableNumber(
      settings.maxLateDays,
      DEFAULT_ASSIGNMENT_POLICY.maxLateDays
    ),
  }
}

export function normalizeGradeVisibilityPolicy(policy?: GradingPolicyRecord) {
  const settings = getObjectSettings(policy?.settings)

  return {
    ...DEFAULT_GRADE_VISIBILITY_POLICY,
    studentsCanSeeDraftGrades: toBoolean(
      settings.studentsCanSeeDraftGrades,
      DEFAULT_GRADE_VISIBILITY_POLICY.studentsCanSeeDraftGrades
    ),
    parentsCanSeeDraftGrades: toBoolean(
      settings.parentsCanSeeDraftGrades,
      DEFAULT_GRADE_VISIBILITY_POLICY.parentsCanSeeDraftGrades
    ),
    showAssignmentFeedbackBeforeFinalGrade: toBoolean(
      settings.showAssignmentFeedbackBeforeFinalGrade,
      DEFAULT_GRADE_VISIBILITY_POLICY.showAssignmentFeedbackBeforeFinalGrade
    ),
    showQuizResultsImmediately: toBoolean(
      settings.showQuizResultsImmediately,
      DEFAULT_GRADE_VISIBILITY_POLICY.showQuizResultsImmediately
    ),
  }
}

export function normalizeDocumentPolicy(policy?: GradingPolicyRecord) {
  const settings = getObjectSettings(policy?.settings)

  return {
    ...DEFAULT_DOCUMENT_POLICY,
    reportCardsRequirePublishedGrades: toBoolean(
      settings.reportCardsRequirePublishedGrades,
      DEFAULT_DOCUMENT_POLICY.reportCardsRequirePublishedGrades
    ),
    transcriptsRequirePublishedGrades: toBoolean(
      settings.transcriptsRequirePublishedGrades,
      DEFAULT_DOCUMENT_POLICY.transcriptsRequirePublishedGrades
    ),
  }
}

async function findScopedPolicy<T>(
  context: PolicyContext,
  query: (where: {
    organizationId: string
    campusId?: string | null
    classSectionId?: string | null
  }) => Promise<T | null>
) {
  const scopes = [
    context.classSectionId
      ? {
          organizationId: context.organizationId,
          campusId: context.campusId ?? null,
          classSectionId: context.classSectionId,
        }
      : null,
    context.campusId
      ? {
          organizationId: context.organizationId,
          campusId: context.campusId,
          classSectionId: null,
        }
      : null,
    {
      organizationId: context.organizationId,
      campusId: null,
      classSectionId: null,
    },
  ].filter(Boolean) as Array<{
    organizationId: string
    campusId?: string | null
    classSectionId?: string | null
  }>

  for (const scope of scopes) {
    const policy = await query(scope)
    if (policy) return policy
  }

  return null
}

function getObjectSettings(settings: Prisma.JsonValue | null | undefined) {
  return settings && typeof settings === "object" && !Array.isArray(settings)
    ? (settings as Record<string, unknown>)
    : {}
}

function toNumber(value: unknown, fallback: number) {
  const next = Number(value)
  return Number.isFinite(next) ? next : fallback
}

function toNullableNumber(value: unknown, fallback: number | null) {
  if (value === null || value === undefined || value === "") return fallback
  const next = Number(value)
  return Number.isFinite(next) ? next : fallback
}

function toBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") return value
  if (value === "true") return true
  if (value === "false") return false
  return fallback
}
