"use client"

import { useCallback, useEffect, useId, useRef, useState } from "react"

import { saveVideoProgress } from "@/modules/learning/actions"
import { getYouTubeWatchUrl } from "@/modules/learning/video"

type YouTubePlayerInstance = {
  destroy: () => void
  getCurrentTime: () => number
  getDuration: () => number
  seekTo: (seconds: number, allowSeekAhead: boolean) => void
}

type YouTubePlayerConstructor = new (
  elementId: string,
  options: {
    videoId: string
    playerVars?: Record<string, string | number>
    events?: {
      onReady?: (event: { target: YouTubePlayerInstance }) => void
      onStateChange?: (event: { data: number; target: YouTubePlayerInstance }) => void
      onError?: () => void
    }
  }
) => YouTubePlayerInstance

declare global {
  interface Window {
    YT?: {
      Player: YouTubePlayerConstructor
      PlayerState: {
        PLAYING: number
        PAUSED: number
        ENDED: number
      }
    }
    onYouTubeIframeAPIReady?: () => void
    __lmsYouTubeApiPromise?: Promise<void>
  }
}

export function YouTubePlayer({
  classSectionId,
  lessonId,
  videoId,
  initialPositionSeconds = 0,
  initialWatchedSeconds = 0,
  initialDurationSeconds = 0,
  initialProgressRate = 0,
  initialCompleted = false,
}: {
  classSectionId: string
  lessonId: string
  videoId: string
  initialPositionSeconds?: number
  initialWatchedSeconds?: number
  initialDurationSeconds?: number
  initialProgressRate?: number
  initialCompleted?: boolean
}) {
  const elementId = `youtube-player-${useId().replace(/:/g, "")}`
  const playerRef = useRef<YouTubePlayerInstance | null>(null)
  const watchedRef = useRef(Math.max(initialWatchedSeconds, initialPositionSeconds))
  const durationRef = useRef(initialDurationSeconds)
  const playingRef = useRef(false)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const [durationSeconds, setDurationSeconds] = useState(initialDurationSeconds)
  const [lastPositionSeconds, setLastPositionSeconds] = useState(
    initialPositionSeconds
  )
  const [progressRate, setProgressRate] = useState(initialProgressRate)
  const [completed, setCompleted] = useState(initialCompleted)

  const persist = useCallback(
    async (forceComplete = false) => {
      const player = playerRef.current
      if (!player) return

      const measuredPosition = Math.max(0, Math.floor(player.getCurrentTime() || 0))
      const measuredDuration = Math.max(
        0,
        Math.floor(player.getDuration() || durationRef.current || 0)
      )
      const nextWatched = forceComplete && measuredDuration
        ? measuredDuration
        : Math.max(watchedRef.current, measuredPosition)

      if (nextWatched <= 0 && measuredPosition <= 0) return

      watchedRef.current = nextWatched
      durationRef.current = measuredDuration
      setLastPositionSeconds(measuredPosition)
      setDurationSeconds(measuredDuration)
      setSaving(true)

      try {
        const result = await saveVideoProgress({
          classSectionId,
          lessonId,
          watchedSeconds: nextWatched,
          durationSeconds: measuredDuration,
          lastPositionSeconds: measuredPosition,
        })
        setProgressRate(result.progressRate)
        setCompleted(result.completed)
      } finally {
        setSaving(false)
      }
    },
    [classSectionId, lessonId]
  )

  useEffect(() => {
    let cancelled = false

    loadYouTubeApi()
      .then(() => {
        if (cancelled || !window.YT?.Player) return

        playerRef.current = new window.YT.Player(elementId, {
          videoId,
          playerVars: {
            enablejsapi: 1,
            origin: window.location.origin,
            rel: 0,
            modestbranding: 1,
          },
          events: {
            onReady: (event) => {
              const duration = Math.floor(event.target.getDuration() || 0)
              if (duration > 0) {
                durationRef.current = duration
                setDurationSeconds(duration)
              }
              if (initialPositionSeconds > 0 && duration > 0) {
                event.target.seekTo(
                  Math.min(initialPositionSeconds, Math.max(0, duration - 1)),
                  true
                )
              }
            },
            onStateChange: (event) => {
              if (!window.YT) return
              playingRef.current = event.data === window.YT.PlayerState.PLAYING
              if (event.data === window.YT.PlayerState.PAUSED) {
                void persist()
              }
              if (event.data === window.YT.PlayerState.ENDED) {
                void persist(true)
              }
            },
            onError: () => {
              setError("This video may not allow embedded playback.")
            },
          },
        })
      })
      .catch(() => {
        setError(
          "YouTube progress tracking could not start. You can still watch this video on YouTube."
        )
      })

    return () => {
      cancelled = true
      void persist()
      playerRef.current?.destroy()
      playerRef.current = null
    }
  }, [elementId, initialPositionSeconds, persist, videoId])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (playingRef.current) {
        void persist()
      }
    }, 15000)

    return () => window.clearInterval(intervalId)
  }, [persist])

  const watchUrl = getYouTubeWatchUrl(videoId)

  return (
    <div className="space-y-3">
      {error ? (
        <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          <p>{error}</p>
          <a
            className="mt-2 inline-flex text-primary underline-offset-4 hover:underline"
            href={watchUrl}
            rel="noreferrer"
            target="_blank"
          >
            Open on YouTube
          </a>
        </div>
      ) : (
        <div className="aspect-video w-full overflow-hidden rounded-md border bg-black">
          <div className="h-full w-full" id={elementId} />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <span>Progress: {progressRate.toFixed(1)}%</span>
        <span>Last position: {formatSeconds(lastPositionSeconds)}</span>
        <span>Duration: {formatSeconds(durationSeconds)}</span>
        <span>Completed: {completed ? "Yes" : "No"}</span>
        <span>{saving ? "Saving..." : "Saved automatically"}</span>
      </div>
    </div>
  )
}

function loadYouTubeApi() {
  if (typeof window === "undefined") return Promise.resolve()
  if (window.YT?.Player) return Promise.resolve()
  if (window.__lmsYouTubeApiPromise) return window.__lmsYouTubeApiPromise

  window.__lmsYouTubeApiPromise = new Promise<void>((resolve, reject) => {
    const previousReady = window.onYouTubeIframeAPIReady

    window.onYouTubeIframeAPIReady = () => {
      previousReady?.()
      resolve()
    }

    const existingScript = document.querySelector(
      'script[src="https://www.youtube.com/iframe_api"]'
    )
    if (existingScript) return

    const script = document.createElement("script")
    script.src = "https://www.youtube.com/iframe_api"
    script.async = true
    script.onerror = () => reject(new Error("Failed to load YouTube API"))
    document.head.appendChild(script)
  })

  return window.__lmsYouTubeApiPromise
}

function formatSeconds(value: number) {
  const seconds = Math.max(0, Math.floor(value))
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60

  return `${minutes}:${remainder.toString().padStart(2, "0")}`
}
