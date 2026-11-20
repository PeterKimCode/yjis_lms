export type SchoolSchedule = {
  opensMinute: number
  lateMinute: number
  closesMinute: number
  weekdays: number[]
  closedDates: string[]
}

export const dailyStatuses = ["PRESENT", "LATE", "ABSENT", "EXCUSED"] as const
export type DailyStatus = (typeof dailyStatuses)[number]
type SchoolPhase = "setup" | "closed-day" | "before" | "open" | "review"

export const dailyLabels: Record<DailyStatus | "PENDING", string> = {
  PRESENT: "Arrived", LATE: "Late", ABSENT: "Absent", EXCUSED: "Excused", PENDING: "Unconfirmed",
}

export function schoolScopeKey(organizationId: string, campusId: string | null) {
  return campusId ? `campus:${campusId}` : `school:${organizationId}`
}

export function schoolTime(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(now)
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value
  const date = `${value("year")}-${value("month")}-${value("day")}`
  return { date, minute: Number(value("hour")) * 60 + Number(value("minute")), weekday: new Date(`${date}T00:00:00Z`).getUTCDay() }
}

export function schoolPhase(schedule: SchoolSchedule | null, time: ReturnType<typeof schoolTime>): SchoolPhase {
  if (!schedule) return "setup"
  if (!schedule.weekdays.includes(time.weekday) || schedule.closedDates.includes(time.date)) return "closed-day"
  if (time.minute < schedule.opensMinute) return "before"
  if (time.minute >= schedule.closesMinute) return "review"
  return "open"
}

export function arrivalStatus(schedule: SchoolSchedule, minute: number) {
  return minute < schedule.lateMinute ? "PRESENT" : "LATE"
}

export function minuteLabel(value: number) {
  return [Math.floor(value / 60), value % 60].map((part) => String(part).padStart(2, "0")).join(":")
}

export function parseMinute(input: string) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input)) return null
  const [hour, minute] = input.split(":").map(Number)
  return hour * 60 + minute
}
