import { AttendanceStatus } from "@prisma/client"

type AttendancePolicySettings = {
  absenceFailThresholdRate?: number
  allowInstructorOverride?: boolean
  countLateAsAbsence?: boolean
  lateThresholdMinutes?: number
}

export type AttendancePolicyView = {
  lateThresholdMinutes: number | null
  absenceFailThresholdRate: number | null
  countLateAsAbsence: boolean
  allowInstructorOverride: boolean
}

export type AttendanceSummaryRecord = {
  status: AttendanceStatus
}

export function normalizeAttendancePolicy(policy?: {
  lateAfterMinutes?: number | null
  absenceAfterMinutes?: number | null
  settings?: unknown
} | null): AttendancePolicyView {
  const settings =
    policy?.settings && typeof policy.settings === "object"
      ? (policy.settings as AttendancePolicySettings)
      : {}

  return {
    lateThresholdMinutes:
      settings.lateThresholdMinutes ?? policy?.lateAfterMinutes ?? null,
    absenceFailThresholdRate: settings.absenceFailThresholdRate ?? null,
    countLateAsAbsence: settings.countLateAsAbsence ?? false,
    allowInstructorOverride: settings.allowInstructorOverride ?? true,
  }
}

export function getAttendanceSummary(
  records: AttendanceSummaryRecord[],
  policy: AttendancePolicyView
) {
  const totalSessions = records.length
  const presentCount = records.filter(
    (record) => record.status === AttendanceStatus.PRESENT
  ).length
  const lateCount = records.filter(
    (record) => record.status === AttendanceStatus.LATE
  ).length
  const absentStatuses: AttendanceStatus[] = [
      AttendanceStatus.ABSENT,
      AttendanceStatus.SICK_LEAVE,
      AttendanceStatus.OFFICIAL_ABSENCE,
  ]
  const absentCount = records.filter((record) =>
    absentStatuses.includes(record.status)
  ).length
  const excusedCount = records.filter(
    (record) => record.status === AttendanceStatus.EXCUSED
  ).length
  const creditedPresentCount =
    presentCount +
    (policy.countLateAsAbsence ? 0 : lateCount) +
    excusedCount +
    records.filter((record) => record.status === AttendanceStatus.EARLY_LEAVE)
      .length
  const attendanceRate =
    totalSessions > 0 ? (creditedPresentCount / totalSessions) * 100 : 0

  return {
    totalSessions,
    presentCount,
    lateCount,
    absentCount,
    attendanceRate,
  }
}
