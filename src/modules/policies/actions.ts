"use server"

import { revalidatePath } from "next/cache"
import { NotificationType, Prisma, UserRole } from "@prisma/client"
import { z } from "zod"

import { getPrismaClient } from "@/lib/prisma"
import { assertAdminScope } from "@/modules/admin/access"
import { writeAuditLog } from "@/modules/audit/service"
import { requireAnyRole } from "@/modules/auth/permissions"
import { createNotificationsForUsers } from "@/modules/notifications/service"
import type { PolicyActionState } from "@/modules/policies/action-state"
import { DEFAULT_DOCUMENT_POLICY, POLICY_NAMES } from "@/modules/policies/defaults"
import {
  ensureDefaultPoliciesForCampus,
  ensureDefaultPoliciesForOrganization,
} from "@/modules/policies/initialize"

const requiredString = z.string().trim().min(1)
const optionalString = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() : ""),
  z.string().transform((value) => (value.length ? value : null))
)

const contextSchema = z.object({
  organizationId: requiredString,
  campusId: optionalString,
})

const attendanceSchema = contextSchema.extend({
  lateThresholdMinutes: z.coerce.number().int().min(0),
  absenceFailThresholdRate: z.preprocess(
    (value) => (String(value ?? "").trim() ? value : null),
    z.coerce.number().min(0).max(100).nullable()
  ),
  countLateAsAbsence: z.boolean(),
  lateEquivalentAbsenceCount: z.coerce.number().min(0).max(1),
  excusedCountsAsPresent: z.boolean(),
  excusedCountsAgainstAttendance: z.boolean(),
  allowInstructorOverride: z.boolean(),
})

export async function saveAttendancePolicy(
  _previousState: PolicyActionState,
  formData: FormData
): Promise<PolicyActionState> {
  const parsed = attendanceSchema.safeParse({
    organizationId: formData.get("organizationId") ?? "",
    campusId: formData.get("campusId") ?? "",
    lateThresholdMinutes: formData.get("lateThresholdMinutes") ?? "10",
    absenceFailThresholdRate: formData.get("absenceFailThresholdRate") ?? "",
    countLateAsAbsence: formData.get("countLateAsAbsence") === "on",
    lateEquivalentAbsenceCount:
      formData.get("lateEquivalentAbsenceCount") ?? "0",
    excusedCountsAsPresent: formData.get("excusedCountsAsPresent") === "on",
    excusedCountsAgainstAttendance:
      formData.get("excusedCountsAgainstAttendance") === "on",
    allowInstructorOverride: formData.get("allowInstructorOverride") === "on",
  })

  if (!parsed.success) {
    return {
      ok: false,
      message:
        "Late threshold must be 0 or greater. Percentages must be between 0 and 100.",
    }
  }

  const data = parsed.data
  const actor = await requirePolicyAdmin()
  await assertAdminScope(data)
  await verifyCampusBelongsToOrganization(data.organizationId, data.campusId)
  const before = await getAttendancePolicySnapshot(data)
  await upsertAttendancePolicy(data)
  const after = getAttendancePolicyFormSnapshot(data)
  await writePolicyAudit({
    action: "policy.attendance.save",
    actorUserId: actor.id,
    campusId: data.campusId,
    metadata: {
      after,
      before,
    },
    organizationId: data.organizationId,
    summary: "Saved attendance policy.",
  })
  revalidatePath("/admin/policies")
  return { ok: true, message: "Attendance policy saved." }
}

const videoSchema = contextSchema.extend({
  completionThresholdPercent: z.coerce.number().min(1).max(100),
  minimumWatchSeconds: z.preprocess(
    (value) => (String(value ?? "").trim() ? value : null),
    z.coerce.number().int().min(0).nullable()
  ),
  requireActualWatchedCoverage: z.boolean(),
})

export async function saveVideoCompletionPolicy(
  _previousState: PolicyActionState,
  formData: FormData
): Promise<PolicyActionState> {
  const parsed = videoSchema.safeParse({
    organizationId: formData.get("organizationId") ?? "",
    campusId: formData.get("campusId") ?? "",
    completionThresholdPercent:
      formData.get("completionThresholdPercent") ?? "90",
    minimumWatchSeconds: formData.get("minimumWatchSeconds") ?? "",
    requireActualWatchedCoverage:
      formData.get("requireActualWatchedCoverage") === "on",
  })

  if (!parsed.success) {
    return {
      ok: false,
      message: "Completion threshold must be between 1 and 100.",
    }
  }

  const data = parsed.data
  const actor = await requirePolicyAdmin()
  await assertAdminScope(data)
  await verifyCampusBelongsToOrganization(data.organizationId, data.campusId)
  const before = await getVideoPolicySnapshot(data)
  await upsertVideoPolicy(data)
  const after = getVideoPolicyFormSnapshot(data)
  await writePolicyAudit({
    action: "policy.video_completion.save",
    actorUserId: actor.id,
    campusId: data.campusId,
    metadata: {
      after,
      before,
    },
    organizationId: data.organizationId,
    summary: "Saved video completion policy.",
  })
  revalidatePath("/admin/policies")
  return { ok: true, message: "Video completion policy saved." }
}

const gradingPolicySchema = contextSchema.extend({
  allowLateSubmissionDefault: z.boolean(),
  allowResubmissionBeforeDue: z.boolean(),
  latePenaltyPercent: z.coerce.number().min(0).max(100),
  maxLateDays: z.preprocess(
    (value) => (String(value ?? "").trim() ? value : null),
    z.coerce.number().int().min(0).nullable()
  ),
  studentsCanSeeDraftGrades: z.boolean(),
  parentsCanSeeDraftGrades: z.boolean(),
  showAssignmentFeedbackBeforeFinalGrade: z.boolean(),
  showQuizResultsImmediately: z.boolean(),
  reportCardsRequirePublishedGrades: z.boolean(),
  transcriptsRequirePublishedGrades: z.boolean(),
  gpaScale: z.coerce.number().min(0).max(10),
})

const gradingScaleSchema = z
  .object({
    id: requiredString,
    organizationId: requiredString,
    name: requiredString,
    description: optionalString,
    rows: z
      .array(
        z.object({
          id: optionalString,
          label: requiredString,
          minPercentage: z.coerce.number().min(0).max(100),
          maxPercentage: z.coerce.number().min(0).max(100),
          gradePoint: z.coerce.number().min(0),
          isPassing: z.boolean(),
        })
      )
      .min(1),
  })
  .superRefine((data, context) => {
    const sorted = [...data.rows].sort(
      (a, b) => a.minPercentage - b.minPercentage
    )

    for (const [index, row] of data.rows.entries()) {
      if (row.minPercentage > row.maxPercentage) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Min score must be less than or equal to max score.",
          path: ["rows", index, "minPercentage"],
        })
      }
    }

    for (let index = 1; index < sorted.length; index += 1) {
      if (sorted[index - 1].maxPercentage >= sorted[index].minPercentage) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Scale ranges cannot overlap.",
          path: ["rows"],
        })
        break
      }
    }

    if (sorted[0]?.minPercentage > 0 || sorted[sorted.length - 1]?.maxPercentage < 100) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Scale should cover scores from 0 to 100.",
        path: ["rows"],
      })
    }
  })

export async function saveGradingAndDocumentPolicy(
  _previousState: PolicyActionState,
  formData: FormData
): Promise<PolicyActionState> {
  const parsed = gradingPolicySchema.safeParse({
    organizationId: formData.get("organizationId") ?? "",
    campusId: formData.get("campusId") ?? "",
    allowLateSubmissionDefault:
      formData.get("allowLateSubmissionDefault") === "on",
    allowResubmissionBeforeDue:
      formData.get("allowResubmissionBeforeDue") === "on",
    latePenaltyPercent: formData.get("latePenaltyPercent") ?? "0",
    maxLateDays: formData.get("maxLateDays") ?? "",
    studentsCanSeeDraftGrades:
      formData.get("studentsCanSeeDraftGrades") === "on",
    parentsCanSeeDraftGrades: formData.get("parentsCanSeeDraftGrades") === "on",
    showAssignmentFeedbackBeforeFinalGrade:
      formData.get("showAssignmentFeedbackBeforeFinalGrade") === "on",
    showQuizResultsImmediately:
      formData.get("showQuizResultsImmediately") === "on",
    reportCardsRequirePublishedGrades:
      formData.get("reportCardsRequirePublishedGrades") === "on",
    transcriptsRequirePublishedGrades:
      formData.get("transcriptsRequirePublishedGrades") === "on",
    gpaScale: formData.get("gpaScale") ?? "4.5",
  })

  if (!parsed.success) {
    return {
      ok: false,
      message:
        "Weights, penalties, and percentages must be between 0 and 100. GPA scale must be 0 or greater.",
    }
  }

  const data = parsed.data
  const actor = await requirePolicyAdmin()
  await assertAdminScope(data)
  await verifyCampusBelongsToOrganization(data.organizationId, data.campusId)
  const before = await getGradingPolicySnapshot(data)
  await upsertGradingPolicy(data)
  const after = getGradingPolicyFormSnapshot(data)
  await writePolicyAudit({
    action: "policy.grading_document.save",
    actorUserId: actor.id,
    campusId: data.campusId,
    metadata: {
      after,
      before,
    },
    organizationId: data.organizationId,
    summary: "Saved assignment, grade visibility, document, and GPA policy.",
  })
  revalidatePath("/admin/policies")
  return { ok: true, message: "Policy saved." }
}

export async function saveGradingScale(
  _previousState: PolicyActionState,
  formData: FormData
): Promise<PolicyActionState> {
  const rowIndexes = new Set(
    [...formData.keys()]
      .map((key) => /^rows\[(\d+)]\[label]$/.exec(key)?.[1])
      .filter((value): value is string => Boolean(value))
  )
  const parsed = gradingScaleSchema.safeParse({
    id: formData.get("id") ?? "",
    organizationId: formData.get("organizationId") ?? "",
    name: formData.get("name") ?? "",
    description: formData.get("description") ?? "",
    rows: [...rowIndexes].map((index) => ({
      id: formData.get(`rows[${index}][id]`) ?? "",
      label: formData.get(`rows[${index}][label]`) ?? "",
      minPercentage: formData.get(`rows[${index}][minPercentage]`) ?? "",
      maxPercentage: formData.get(`rows[${index}][maxPercentage]`) ?? "",
      gradePoint: formData.get(`rows[${index}][gradePoint]`) ?? "",
      isPassing: formData.get(`rows[${index}][isPassing]`) === "on",
    })),
  })

  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ??
        "Letter grade is required and score ranges must be valid.",
    }
  }

  const data = parsed.data
  const actor = await requirePolicyAdmin()
  await assertAdminScope({ organizationId: data.organizationId })

  const prisma = getPrismaClient()
  const scale = await prisma.gradingScale.findFirst({
    where: { id: data.id, organizationId: data.organizationId },
    include: { items: true },
  })

  if (!scale) {
    return { ok: false, message: "Grading scale not found." }
  }

  const before = getGradingScaleSnapshot(scale)

  await prisma.gradingScale.update({
    where: { id: scale.id },
    data: {
      name: data.name,
      description: data.description,
    },
  })

  const submittedIds = new Set(
    data.rows
      .map((row) => row.id)
      .filter((id): id is string => typeof id === "string" && id.length > 0)
  )
  await prisma.gradingScaleItem.deleteMany({
    where: {
      gradingScaleId: scale.id,
      id: { notIn: [...submittedIds] },
    },
  })

  for (const row of data.rows) {
    const values = {
      label: row.label,
      minPercentage: new Prisma.Decimal(row.minPercentage),
      maxPercentage: new Prisma.Decimal(row.maxPercentage),
      gradePoint: new Prisma.Decimal(row.gradePoint),
      isPassing: row.isPassing,
    }

    if (row.id) {
      await prisma.gradingScaleItem.update({
        where: { id: row.id },
        data: values,
      })
    } else {
      await prisma.gradingScaleItem.create({
        data: {
          gradingScaleId: scale.id,
          ...values,
        },
      })
    }
  }

  await writePolicyAudit({
    action: "policy.grading_scale.save",
    actorUserId: actor.id,
    metadata: {
      after: getGradingScaleFormSnapshot(data),
      before,
    },
    organizationId: data.organizationId,
    summary: `Saved grading scale ${data.name}.`,
  })
  await notifyPolicyAdmins({
    actorUserId: actor.id,
    body: `${actor.name ?? actor.email ?? "An admin"} updated ${data.name}.`,
    entityId: scale.id,
    organizationId: data.organizationId,
    title: "Grading scale updated",
  })
  revalidatePath("/admin/policies")
  return { ok: true, message: "Grading scale saved." }
}

export async function initializeMissingPolicyDefaults(
  _previousState: PolicyActionState,
  formData: FormData
): Promise<PolicyActionState> {
  const parsed = contextSchema.safeParse({
    organizationId: formData.get("organizationId") ?? "",
    campusId: formData.get("campusId") ?? "",
  })

  if (!parsed.success) {
    return { ok: false, message: "Select a valid organization or campus." }
  }

  const data = parsed.data
  const actor = await requirePolicyAdmin()

  try {
    await assertAdminScope(data)
    await verifyCampusBelongsToOrganization(data.organizationId, data.campusId)

    if (data.campusId) {
      await ensureDefaultPoliciesForCampus({
        organizationId: data.organizationId,
        campusId: data.campusId,
      })
    } else {
      await ensureDefaultPoliciesForOrganization({
        organizationId: data.organizationId,
      })
    }

    await writePolicyAudit({
      action: "policy.defaults.initialize",
      actorUserId: actor.id,
      campusId: data.campusId,
      organizationId: data.organizationId,
      summary: data.campusId
        ? "Initialized missing campus policy defaults."
        : "Initialized missing organization policy defaults.",
    })
    revalidatePath("/admin/policies")
    return { ok: true, message: "Missing default policies initialized." }
  } catch (error) {
    console.error("Default policy initialization failed", {
      organizationId: data.organizationId,
      campusId: data.campusId,
      error: error instanceof Error ? error.message : String(error),
    })

    return {
      ok: false,
      message:
        "Default policy initialization failed. Check the server logs and try again.",
    }
  }
}

async function requirePolicyAdmin() {
  return requireAnyRole([
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.SCHOOL_ADMIN,
    UserRole.ACADEMIC_STAFF,
  ])
}

async function writePolicyAudit(input: {
  action: string
  actorUserId: string
  campusId?: string | null
  metadata?: Prisma.InputJsonObject
  organizationId: string
  summary: string
}) {
  await writeAuditLog({
    action: input.action,
    actorUserId: input.actorUserId,
    campusId: input.campusId,
    entityId: input.campusId ?? input.organizationId,
    entityType: input.campusId ? "CampusPolicy" : "OrganizationPolicy",
    metadata: input.metadata,
    organizationId: input.organizationId,
    summary: input.summary,
  })
}

async function notifyPolicyAdmins({
  actorUserId,
  body,
  entityId,
  organizationId,
  title,
}: {
  actorUserId: string
  body: string
  entityId: string
  organizationId: string
  title: string
}) {
  const admins = await getPrismaClient().userRoleAssignment.findMany({
    where: {
      organizationId,
      role: {
        in: [
          UserRole.SUPER_ADMIN,
          UserRole.ORG_ADMIN,
          UserRole.SCHOOL_ADMIN,
          UserRole.ACADEMIC_STAFF,
        ],
      },
      user: { isActive: true },
    },
    select: { userId: true },
  })

  await createNotificationsForUsers(
    admins.map((admin) => admin.userId),
    {
      actionUrl: "/admin/policies",
      actorUserId,
      body,
      entityId,
      entityType: "GradingScale",
      title,
      type: NotificationType.SYSTEM_NOTICE,
    }
  )
}

async function verifyCampusBelongsToOrganization(
  organizationId: string,
  campusId: string | null
) {
  if (!campusId) return

  const campus = await getPrismaClient().campus.findFirst({
    where: { id: campusId, organizationId },
    select: { id: true },
  })

  if (!campus) {
    throw new Error("Campus does not belong to the selected organization.")
  }
}

async function upsertAttendancePolicy(
  data: z.infer<typeof attendanceSchema>
) {
  const prisma = getPrismaClient()
  const existing = await prisma.attendancePolicy.findFirst({
    where: scopedWhere(data, POLICY_NAMES.attendance),
  })
  const values = {
    lateAfterMinutes: data.lateThresholdMinutes,
    absenceAfterMinutes: null,
    settings: {
      lateThresholdMinutes: data.lateThresholdMinutes,
      absenceFailThresholdRate: data.absenceFailThresholdRate,
      countLateAsAbsence: data.countLateAsAbsence,
      lateEquivalentAbsenceCount: data.lateEquivalentAbsenceCount,
      excusedCountsAsPresent: data.excusedCountsAsPresent,
      excusedCountsAgainstAttendance: data.excusedCountsAgainstAttendance,
      allowInstructorOverride: data.allowInstructorOverride,
    },
  }

  if (existing) {
    await prisma.attendancePolicy.update({ where: { id: existing.id }, data: values })
  } else {
    await prisma.attendancePolicy.create({
      data: {
        organizationId: data.organizationId,
        campusId: data.campusId,
        name: POLICY_NAMES.attendance,
        ...values,
      },
    })
  }
}

async function upsertVideoPolicy(data: z.infer<typeof videoSchema>) {
  const prisma = getPrismaClient()
  const existing = await prisma.videoCompletionPolicy.findFirst({
    where: scopedWhere(data, POLICY_NAMES.videoCompletion),
  })
  const values = {
    requiredPercentage: new Prisma.Decimal(data.completionThresholdPercent),
    settings: {
      completionThresholdPercent: data.completionThresholdPercent,
      minimumWatchSeconds: data.minimumWatchSeconds,
      requireActualWatchedCoverage: data.requireActualWatchedCoverage,
    },
  }

  if (existing) {
    await prisma.videoCompletionPolicy.update({ where: { id: existing.id }, data: values })
  } else {
    await prisma.videoCompletionPolicy.create({
      data: {
        organizationId: data.organizationId,
        campusId: data.campusId,
        name: POLICY_NAMES.videoCompletion,
        ...values,
      },
    })
  }
}

async function upsertGradingPolicy(
  data: z.infer<typeof gradingPolicySchema>
) {
  const prisma = getPrismaClient()
  const existing = await prisma.gradingPolicy.findFirst({
    where: scopedWhere(data, POLICY_NAMES.grading),
  })
  const values = {
    gpaScale: new Prisma.Decimal(data.gpaScale),
    settings: {
      allowLateSubmissionDefault: data.allowLateSubmissionDefault,
      allowResubmissionBeforeDue: data.allowResubmissionBeforeDue,
      latePenaltyPercent: data.latePenaltyPercent,
      maxLateDays: data.maxLateDays,
      studentsCanSeeDraftGrades: data.studentsCanSeeDraftGrades,
      parentsCanSeeDraftGrades: data.parentsCanSeeDraftGrades,
      showAssignmentFeedbackBeforeFinalGrade:
        data.showAssignmentFeedbackBeforeFinalGrade,
      showQuizResultsImmediately: data.showQuizResultsImmediately,
      reportCardsRequirePublishedGrades: data.reportCardsRequirePublishedGrades,
      transcriptsRequirePublishedGrades: data.transcriptsRequirePublishedGrades,
      adminPreviewAllowed: DEFAULT_DOCUMENT_POLICY.adminPreviewAllowed,
    },
  }

  if (existing) {
    await prisma.gradingPolicy.update({ where: { id: existing.id }, data: values })
  } else {
    await prisma.gradingPolicy.create({
      data: {
        organizationId: data.organizationId,
        campusId: data.campusId,
        name: POLICY_NAMES.grading,
        ...values,
      },
    })
  }
}

async function getAttendancePolicySnapshot(
  data: z.infer<typeof attendanceSchema>
): Promise<Prisma.InputJsonObject> {
  const policy = await getPrismaClient().attendancePolicy.findFirst({
    where: scopedWhere(data, POLICY_NAMES.attendance),
    select: {
      lateAfterMinutes: true,
      settings: true,
    },
  })

  if (!policy) return { configured: false }

  const settings = getObjectSettings(policy.settings)
  return {
    configured: true,
    allowInstructorOverride: getBooleanSetting(
      settings,
      "allowInstructorOverride",
      true
    ),
    absenceFailThresholdRate: getNullableNumberSetting(
      settings,
      "absenceFailThresholdRate"
    ),
    countLateAsAbsence: getBooleanSetting(settings, "countLateAsAbsence", false),
    excusedCountsAgainstAttendance: getBooleanSetting(
      settings,
      "excusedCountsAgainstAttendance",
      false
    ),
    excusedCountsAsPresent: getBooleanSetting(
      settings,
      "excusedCountsAsPresent",
      false
    ),
    lateEquivalentAbsenceCount: getNumberSetting(
      settings,
      "lateEquivalentAbsenceCount",
      0
    ),
    lateThresholdMinutes: getNumberSetting(
      settings,
      "lateThresholdMinutes",
      policy.lateAfterMinutes ?? 10
    ),
  }
}

function getAttendancePolicyFormSnapshot(
  data: z.infer<typeof attendanceSchema>
): Prisma.InputJsonObject {
  return {
    configured: true,
    absenceFailThresholdRate: data.absenceFailThresholdRate,
    allowInstructorOverride: data.allowInstructorOverride,
    countLateAsAbsence: data.countLateAsAbsence,
    excusedCountsAgainstAttendance: data.excusedCountsAgainstAttendance,
    excusedCountsAsPresent: data.excusedCountsAsPresent,
    lateEquivalentAbsenceCount: data.lateEquivalentAbsenceCount,
    lateThresholdMinutes: data.lateThresholdMinutes,
  }
}

async function getVideoPolicySnapshot(
  data: z.infer<typeof videoSchema>
): Promise<Prisma.InputJsonObject> {
  const policy = await getPrismaClient().videoCompletionPolicy.findFirst({
    where: scopedWhere(data, POLICY_NAMES.videoCompletion),
    select: {
      requiredPercentage: true,
      settings: true,
    },
  })

  if (!policy) return { configured: false }

  const settings = getObjectSettings(policy.settings)
  return {
    configured: true,
    completionThresholdPercent: getNumberSetting(
      settings,
      "completionThresholdPercent",
      Number(policy.requiredPercentage)
    ),
    minimumWatchSeconds: getNullableNumberSetting(
      settings,
      "minimumWatchSeconds"
    ),
    requireActualWatchedCoverage: getBooleanSetting(
      settings,
      "requireActualWatchedCoverage",
      true
    ),
  }
}

function getVideoPolicyFormSnapshot(
  data: z.infer<typeof videoSchema>
): Prisma.InputJsonObject {
  return {
    configured: true,
    completionThresholdPercent: data.completionThresholdPercent,
    minimumWatchSeconds: data.minimumWatchSeconds,
    requireActualWatchedCoverage: data.requireActualWatchedCoverage,
  }
}

async function getGradingPolicySnapshot(
  data: z.infer<typeof gradingPolicySchema>
): Promise<Prisma.InputJsonObject> {
  const policy = await getPrismaClient().gradingPolicy.findFirst({
    where: scopedWhere(data, POLICY_NAMES.grading),
    select: {
      gpaScale: true,
      settings: true,
    },
  })

  if (!policy) return { configured: false }

  const settings = getObjectSettings(policy.settings)
  return {
    configured: true,
    allowLateSubmissionDefault: getBooleanSetting(
      settings,
      "allowLateSubmissionDefault",
      false
    ),
    allowResubmissionBeforeDue: getBooleanSetting(
      settings,
      "allowResubmissionBeforeDue",
      true
    ),
    gpaScale: getNumberSetting(settings, "gpaScale", Number(policy.gpaScale)),
    latePenaltyPercent: getNumberSetting(settings, "latePenaltyPercent", 0),
    maxLateDays: getNullableNumberSetting(settings, "maxLateDays"),
    parentsCanSeeDraftGrades: getBooleanSetting(
      settings,
      "parentsCanSeeDraftGrades",
      false
    ),
    reportCardsRequirePublishedGrades: getBooleanSetting(
      settings,
      "reportCardsRequirePublishedGrades",
      true
    ),
    showAssignmentFeedbackBeforeFinalGrade: getBooleanSetting(
      settings,
      "showAssignmentFeedbackBeforeFinalGrade",
      true
    ),
    showQuizResultsImmediately: getBooleanSetting(
      settings,
      "showQuizResultsImmediately",
      false
    ),
    studentsCanSeeDraftGrades: getBooleanSetting(
      settings,
      "studentsCanSeeDraftGrades",
      false
    ),
    transcriptsRequirePublishedGrades: getBooleanSetting(
      settings,
      "transcriptsRequirePublishedGrades",
      true
    ),
  }
}

function getGradingPolicyFormSnapshot(
  data: z.infer<typeof gradingPolicySchema>
): Prisma.InputJsonObject {
  return {
    configured: true,
    allowLateSubmissionDefault: data.allowLateSubmissionDefault,
    allowResubmissionBeforeDue: data.allowResubmissionBeforeDue,
    gpaScale: data.gpaScale,
    latePenaltyPercent: data.latePenaltyPercent,
    maxLateDays: data.maxLateDays,
    parentsCanSeeDraftGrades: data.parentsCanSeeDraftGrades,
    reportCardsRequirePublishedGrades: data.reportCardsRequirePublishedGrades,
    showAssignmentFeedbackBeforeFinalGrade:
      data.showAssignmentFeedbackBeforeFinalGrade,
    showQuizResultsImmediately: data.showQuizResultsImmediately,
    studentsCanSeeDraftGrades: data.studentsCanSeeDraftGrades,
    transcriptsRequirePublishedGrades: data.transcriptsRequirePublishedGrades,
  }
}

function getGradingScaleSnapshot(scale: {
  description: string | null
  id: string
  items: Array<{
    gradePoint: Prisma.Decimal | null
    isPassing: boolean
    label: string
    maxPercentage: Prisma.Decimal
    minPercentage: Prisma.Decimal
  }>
  name: string
}): Prisma.InputJsonObject {
  return {
    configured: true,
    description: scale.description,
    id: scale.id,
    name: scale.name,
    rows: scale.items
      .map((row) => ({
        gradePoint: row.gradePoint ? Number(row.gradePoint) : 0,
        isPassing: row.isPassing,
        label: row.label,
        maxPercentage: Number(row.maxPercentage),
        minPercentage: Number(row.minPercentage),
      }))
      .sort((a, b) => a.minPercentage - b.minPercentage),
  }
}

function getGradingScaleFormSnapshot(
  data: z.infer<typeof gradingScaleSchema>
): Prisma.InputJsonObject {
  return {
    configured: true,
    description: data.description,
    id: data.id,
    name: data.name,
    rows: data.rows
      .map((row) => ({
        gradePoint: row.gradePoint,
        isPassing: row.isPassing,
        label: row.label,
        maxPercentage: row.maxPercentage,
        minPercentage: row.minPercentage,
      }))
      .sort((a, b) => a.minPercentage - b.minPercentage),
  }
}

function getObjectSettings(value: Prisma.JsonValue | null) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function getBooleanSetting(
  settings: Record<string, unknown>,
  key: string,
  fallback: boolean
) {
  return typeof settings[key] === "boolean" ? settings[key] : fallback
}

function getNumberSetting(
  settings: Record<string, unknown>,
  key: string,
  fallback: number
) {
  const value = settings[key]
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function getNullableNumberSetting(
  settings: Record<string, unknown>,
  key: string
) {
  const value = settings[key]
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function scopedWhere(
  data: { organizationId: string; campusId: string | null },
  name: string
) {
  return {
    organizationId: data.organizationId,
    campusId: data.campusId,
    classSectionId: null,
    name,
  }
}
