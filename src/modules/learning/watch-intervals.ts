export type WatchedInterval = {
  start: number
  end: number
}

export function readWatchedIntervals(value: unknown, legacyWatchedSeconds = 0): WatchedInterval[] {
  if (!Array.isArray(value)) {
    // Previous records stored only a total. Preserve that total as the initial watched span.
    return legacyWatchedSeconds > 0 ? [{ start: 0, end: legacyWatchedSeconds }] : []
  }
  return mergeWatchedIntervals(value.filter((item): item is WatchedInterval =>
    typeof item === "object" && item !== null && Number.isFinite(item.start) && Number.isFinite(item.end) && item.start >= 0 && item.end > item.start
  ))
}

export function getVideoCompletion(intervals: WatchedInterval[], duration: number) {
  const bounded = duration > 0 ? mergeWatchedIntervals(intervals.map((item) => ({ start: Math.min(duration, item.start), end: Math.min(duration, item.end) }))) : mergeWatchedIntervals(intervals)
  const watchedSeconds = getWatchedSeconds(bounded)
  const completed = duration > 0 && watchedSeconds >= duration
  return { intervals: bounded, watchedSeconds, completed, progressRate: duration > 0 ? Math.min(100, watchedSeconds / duration * 100) : 0 }
}

export function addWatchedInterval(
  intervals: WatchedInterval[],
  start: number,
  end: number
) {
  const normalizedStart = Math.max(0, Math.min(start, end))
  const normalizedEnd = Math.max(0, Math.max(start, end))

  if (normalizedEnd <= normalizedStart) {
    return intervals
  }

  return mergeWatchedIntervals([
    ...intervals,
    { start: normalizedStart, end: normalizedEnd },
  ])
}

export function mergeWatchedIntervals(intervals: WatchedInterval[]) {
  const sorted = intervals
    .filter((interval) => interval.end > interval.start)
    .sort((left, right) => left.start - right.start)
  const merged: WatchedInterval[] = []

  for (const interval of sorted) {
    const previous = merged.at(-1)

    if (!previous || interval.start > previous.end) {
      merged.push({ ...interval })
    } else {
      previous.end = Math.max(previous.end, interval.end)
    }
  }

  return merged
}

export function getWatchedSeconds(intervals: WatchedInterval[]) {
  return Math.floor(
    mergeWatchedIntervals(intervals).reduce(
      (total, interval) => total + interval.end - interval.start,
      0
    )
  )
}

export function isLikelySeek(
  previousTime: number,
  currentTime: number,
  sampleWindowSeconds: number
) {
  const delta = currentTime - previousTime

  if (delta < -1) {
    return true
  }

  return delta > sampleWindowSeconds + 1.5
}
