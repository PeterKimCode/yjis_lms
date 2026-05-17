"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { saveVideoProgress } from "@/modules/learning/actions"
import {
  addWatchedInterval,
  getWatchedSeconds,
  isLikelySeek,
  type WatchedInterval,
} from "@/modules/learning/watch-intervals"

export function VideoProgressPlayer({
  classSectionId,
  lessonId,
  videoUrl,
  durationSeconds,
  initialLastPositionSeconds = 0,
  initialWatchedSeconds = 0,
  initialProgressRate = 0,
  initialCompleted = false,
}: {
  classSectionId: string
  lessonId: string
  videoUrl: string
  durationSeconds?: number | null
  initialLastPositionSeconds?: number
  initialWatchedSeconds?: number
  initialProgressRate?: number
  initialCompleted?: boolean
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const intervalsRef = useRef<WatchedInterval[]>([])
  const lastSampleRef = useRef<number | null>(null)
  const watchedRef = useRef(Math.max(0, initialWatchedSeconds))
  const [watchedSeconds, setWatchedSeconds] = useState(
    Math.max(0, initialWatchedSeconds)
  )
  const [lastPositionSeconds, setLastPositionSeconds] = useState(
    Math.max(0, initialLastPositionSeconds)
  )
  const [progressRate, setProgressRate] = useState(initialProgressRate)
  const [completed, setCompleted] = useState(initialCompleted)
  const [saving, setSaving] = useState(false)
  const [hasRestoredPosition, setHasRestoredPosition] = useState(false)

  const persist = useCallback(async () => {
    const video = videoRef.current
    if (!video) return

    const measuredDuration = Number.isFinite(video.duration)
      ? Math.floor(video.duration)
      : 0
    const measuredPosition = Math.floor(video.currentTime)
    const sessionWatchedSeconds = getWatchedSeconds(intervalsRef.current)
    const nextWatchedSeconds = Math.max(
      watchedRef.current,
      sessionWatchedSeconds
    )

    if (nextWatchedSeconds <= 0 && measuredPosition <= 0) return

    setSaving(true)
    try {
      const result = await saveVideoProgress({
        classSectionId,
        lessonId,
        watchedSeconds: nextWatchedSeconds,
        durationSeconds: measuredDuration || durationSeconds || 0,
        lastPositionSeconds: measuredPosition || lastPositionSeconds,
      })
      watchedRef.current = nextWatchedSeconds
      setWatchedSeconds(nextWatchedSeconds)
      setProgressRate(result.progressRate)
      setCompleted(result.completed)
    } finally {
      setSaving(false)
    }
  }, [
    classSectionId,
    durationSeconds,
    lastPositionSeconds,
    lessonId,
  ])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void persist()
    }, 15000)

    return () => window.clearInterval(intervalId)
  }, [persist])

  return (
    <div className="space-y-3">
      <video
        className="aspect-video w-full rounded-md border bg-black"
        controls
        onEnded={() => void persist()}
        onLoadedMetadata={() => {
          const video = videoRef.current
          if (!video || hasRestoredPosition || initialLastPositionSeconds <= 0) {
            return
          }
          video.currentTime = Math.min(
            initialLastPositionSeconds,
            Math.max(0, video.duration - 1)
          )
          setHasRestoredPosition(true)
        }}
        onPause={() => void persist()}
        onPlay={(event) => {
          lastSampleRef.current = event.currentTarget.currentTime
        }}
        onTimeUpdate={(event) => {
          const position = Math.floor(event.currentTarget.currentTime)
          const previousTime = lastSampleRef.current

          if (
            previousTime !== null &&
            event.currentTarget.currentTime > previousTime &&
            !isLikelySeek(previousTime, event.currentTarget.currentTime, 5)
          ) {
            intervalsRef.current = addWatchedInterval(
              intervalsRef.current,
              previousTime,
              event.currentTarget.currentTime
            )
            const nextWatchedSeconds = Math.max(
              watchedRef.current,
              getWatchedSeconds(intervalsRef.current)
            )
            watchedRef.current = nextWatchedSeconds
            setWatchedSeconds(nextWatchedSeconds)
          }

          lastSampleRef.current = event.currentTarget.currentTime
          setLastPositionSeconds(position)
        }}
        ref={videoRef}
        src={videoUrl}
      />
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <span>Progress: {progressRate.toFixed(1)}%</span>
        <span>Watched: {watchedSeconds}s</span>
        <span>Position: {lastPositionSeconds}s</span>
        <span>{completed ? "Completed" : "In progress"}</span>
        <span>{saving ? "Saving..." : "Saved automatically"}</span>
      </div>
    </div>
  )
}
