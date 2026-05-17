export type WatchedInterval = {
  start: number
  end: number
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
