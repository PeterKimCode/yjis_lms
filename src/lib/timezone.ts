export function parseDateTimeLocalInTimeZone(
  value: string | null | undefined,
  timeZone: string | null | undefined
) {
  if (!value) return null

  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/
  )
  if (!match) {
    const fallback = new Date(value)
    return Number.isNaN(fallback.getTime()) ? null : fallback
  }

  const [, year, month, day, hour, minute, second = "00"] = match
  const utcWallClock = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  )

  const zone = timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone
  try {
    const firstOffset = getTimeZoneOffsetMs(new Date(utcWallClock), zone)
    const firstUtc = utcWallClock - firstOffset
    const secondOffset = getTimeZoneOffsetMs(new Date(firstUtc), zone)
    return new Date(utcWallClock - secondOffset)
  } catch {
    const fallback = new Date(value)
    return Number.isNaN(fallback.getTime()) ? null : fallback
  }
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(date)

  const valueByType = new Map(parts.map((part) => [part.type, part.value]))
  const localAsUtc = Date.UTC(
    Number(valueByType.get("year")),
    Number(valueByType.get("month")) - 1,
    Number(valueByType.get("day")),
    Number(valueByType.get("hour")),
    Number(valueByType.get("minute")),
    Number(valueByType.get("second"))
  )

  return localAsUtc - date.getTime()
}
