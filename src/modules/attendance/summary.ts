import { AttendanceStatus } from "@prisma/client"

import { normalizeAttendancePolicy as normalizeResolvedAttendancePolicy } from "@/modules/policies/resolve"
import type { AttendancePolicyValue } from "@/modules/policies/types"

export type AttendancePolicyView = AttendancePolicyValue

export type AttendanceSummaryRecord = {
  status: AttendanceStatus
}

export function normalizeAttendancePolicy(policy?: {
  lateAfterMinutes?: number | null
  absenceAfterMinutes?: number | null
  settings?: unknown
} | null): AttendancePolicyView {
  return normalizeResolvedAttendancePolicy(
    policy
      ? {
          lateAfterMinutes: policy.lateAfterMinutes ?? null,
          absenceAfterMinutes: policy.absenceAfterMinutes ?? null,
          settings: (policy.settings ?? null) as never,
        }
      : null
  )
}

export function getAttendanceSummary(
  records: AttendanceSummaryRecord[],
  policy: AttendancePolicyView
) {
  const countedRecords = records.filter((record) => isCounted(record.status, policy))
  const totalSessions = countedRecords.length
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
    countedRecords.reduce((total, record) => total + attendanceCredit(record.status, policy), 0)
  const attendanceRate =
    totalSessions > 0 ? (creditedPresentCount / totalSessions) * 100 : 0

  return {
    totalSessions,
    presentCount,
    lateCount,
    absentCount,
    excusedCount,
    attendanceRate,
  }
}

function isCounted(status: AttendanceStatus, policy: AttendancePolicyView) {
  if (status === AttendanceStatus.PENDING) return false

  if (
    status === AttendanceStatus.EXCUSED ||
    status === AttendanceStatus.SICK_LEAVE ||
    status === AttendanceStatus.OFFICIAL_ABSENCE
  ) {
    return policy.excusedCountsAsPresent || policy.excusedCountsAgainstAttendance
  }

  return true
}

function attendanceCredit(status: AttendanceStatus, policy: AttendancePolicyView) {
  if (status === AttendanceStatus.PRESENT) return 1
  if (status === AttendanceStatus.LATE) {
    if (policy.countLateAsAbsence) {
      return Math.max(0, 1 - policy.lateEquivalentAbsenceCount)
    }
    return 0.5
  }
  if (status === AttendanceStatus.EARLY_LEAVE) return 0.75
  if (
    status === AttendanceStatus.EXCUSED ||
    status === AttendanceStatus.SICK_LEAVE ||
    status === AttendanceStatus.OFFICIAL_ABSENCE
  ) {
    return policy.excusedCountsAsPresent ? 1 : 0
  }

  return 0
}
