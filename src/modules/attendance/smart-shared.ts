import type { AttendanceStatus } from "@prisma/client"

export const qrPrefix = "LMS-ATTENDANCE:"
export const qrWindowMinutes = [5, 10, 15, 30] as const

export const attendanceLabels = {
  PRESENT: "Present",
  LATE: "Late",
  EARLY_LEAVE: "Early leave",
  ABSENT: "Absent",
  EXCUSED: "Excused",
  SICK_LEAVE: "Sick leave",
  OFFICIAL_ABSENCE: "Official absence",
  PENDING: "Pending",
} satisfies Record<AttendanceStatus, string>
