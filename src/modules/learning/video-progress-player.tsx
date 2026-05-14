"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import { saveVideoProgress } from "@/modules/learning/actions"

export function VideoProgressPlayer({
  classSectionId,
  lessonId,
  videoUrl,
  durationSeconds,
  initialLastPositionSeconds = 0,
  initialProgressRate = 0,
  initialCompleted = false,
}: {
  classSectionId: string
  lessonId: string
  videoUrl: string
  durationSeconds?: number | null
  initialLastPositionSeconds?: number
  initialProgressRate?: number
  initialCompleted?: boolean
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [watchedSeconds, setWatchedSeconds] = useState(
    Math.max(0, initialLastPositionSeconds)
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
    if (!video || watchedSeconds <= 0) return

    const measuredDuration = Number.isFinite(video.duration)
      ? Math.floor(video.duration)
      : 0
    const measuredPosition = Math.floor(video.currentTime)

    setSaving(true)
    try {
      const result = await saveVideoProgress({
        classSectionId,
        lessonId,
        watchedSeconds,
        durationSeconds: measuredDuration || durationSeconds || 0,
        lastPositionSeconds: measuredPosition || lastPositionSeconds,
      })
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
    watchedSeconds,
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
        onTimeUpdate={(event) => {
          const position = Math.floor(event.currentTarget.currentTime)
          setLastPositionSeconds(position)
          setWatchedSeconds((current) => Math.max(current, position))
        }}
        ref={videoRef}
        src={videoUrl}
      />
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <span>Progress: {progressRate.toFixed(1)}%</span>
        <span>Position: {lastPositionSeconds}s</span>
        <span>{completed ? "Completed" : "In progress"}</span>
        <span>{saving ? "Saving..." : "Saved automatically"}</span>
      </div>
    </div>
  )
}
