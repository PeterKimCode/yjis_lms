"use client"

import { useEffect, useEffectEvent, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Camera, ScanLine } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { recordSchoolAttendanceQr } from "./school-actions"
import { dailyLabels } from "./school-rules"
import { confirmAttendanceIdentity, inspectAttendanceQr } from "./smart-actions"
import { qrPrefix } from "./smart-shared"

type Review = { studentId: string; studentName: string; receipt: string }

type ScannerProps = { classSessionId: string; recordAction?: never } |
  { recordAction: (code: string) => ReturnType<typeof recordSchoolAttendanceQr>; classSessionId?: never }

export function AttendanceQrScanner({ classSessionId, recordAction }: ScannerProps) {
  const router = useRouter()
  const video = useRef<HTMLVideoElement>(null)
  const [camera, setCamera] = useState(false)
  const [review, setReview] = useState<Review | null>(null)
  const [message, setMessage] = useState("")
  const [pending, startTransition] = useTransition()
  const automatic = Boolean(recordAction)

  const scanForReview = useEffectEvent((code: string) => {
    if (!classSessionId) return
    setCamera(false)
    setMessage("Checking QR…")
    startTransition(async () => {
      try {
        const result = await inspectAttendanceQr(classSessionId, code)
        if ("error" in result && result.error) setMessage(result.error)
        else if (result.studentId && result.studentName && result.receipt) {
          setReview({ studentId: result.studentId, studentName: result.studentName, receipt: result.receipt })
          setMessage("")
        }
      } catch {
        setMessage("Could not read attendance. Try scanning again.")
      }
    })
  })

  const recordScan = useEffectEvent(async (code: string, isActive: () => boolean) => {
    if (!recordAction) return
    try {
      const result = await recordAction(code)
      if (!isActive()) return
      if ("ok" in result) {
        setMessage(`${result.studentName} · ${dailyLabels[result.status]}`)
      } else {
        setMessage(result.error)
      }
    } catch {
      if (isActive()) setMessage("Could not record the check-in. Ask the student to show their next QR.")
    }
  })

  useEffect(() => {
    if (!camera || !video.current) return
    const player = video.current
    const canvas = document.createElement("canvas")
    const context = canvas.getContext("2d", { willReadFrequently: true })
    let stream: MediaStream | undefined
    let timer: number | undefined
    let stopped = false
    let lastCode: string | undefined

    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia || !context) throw new Error("Camera unavailable")
        const { default: decodeQr } = await import("jsqr")
        if (stopped) return
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 960 } },
        })
        if (stopped) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        player.srcObject = stream
        await player.play()
        if (stopped) return
        setMessage(automatic
          ? "Check the student's identity, then scan their QR to record attendance."
          : "Point the camera at the QR on the student's screen.")

        const frame = () => {
          if (stopped) return
          try {
            if (player.readyState >= 2 && player.videoWidth && player.videoHeight) {
              const scale = Math.min(1, 640 / Math.max(player.videoWidth, player.videoHeight))
              const width = Math.round(player.videoWidth * scale)
              const height = Math.round(player.videoHeight * scale)
              if (canvas.width !== width || canvas.height !== height) {
                canvas.width = width
                canvas.height = height
              }
              context.drawImage(player, 0, 0, width, height)
              const pixels = context.getImageData(0, 0, width, height)
              const code = decodeQr(pixels.data, width, height, { inversionAttempts: "dontInvert" })?.data
              if (code?.startsWith(qrPrefix)) {
                if (!automatic) {
                  scanForReview(code)
                  return
                }
                if (code !== lastCode) {
                  lastCode = code
                  void recordScan(code, () => !stopped).finally(() => {
                    if (!stopped) timer = window.setTimeout(frame, 160)
                  })
                  return
                }
              }
            }
            timer = window.setTimeout(frame, 160)
          } catch {
            setCamera(false)
            setMessage("The camera stopped. Start the scanner again.")
          }
        }
        frame()
      } catch {
        if (stopped) return
        setCamera(false)
        setMessage("Camera unavailable. Check browser permissions or use manual attendance in the roster.")
      }
    }

    void start()
    return () => {
      stopped = true
      window.clearTimeout(timer)
      stream?.getTracks().forEach((track) => track.stop())
      player.srcObject = null
    }
  }, [automatic, camera])

  function confirm() {
    if (!review || !classSessionId) return
    startTransition(async () => {
      try {
        const input = { studentId: review.studentId, receipt: review.receipt }
        const result = await confirmAttendanceIdentity({ classSessionId, ...input })
        setMessage("error" in result && result.error ? result.error : `${review.studentName} checked in.`)
        setReview(null)
        router.refresh()
      } catch {
        setMessage("Could not save the check-in. Scan again if the roster has not changed.")
      }
    })
  }

  return (
    <section aria-labelledby="attendance-scan-heading" className="space-y-3 rounded-lg border bg-white p-4">
      <h2 id="attendance-scan-heading" className="flex items-center gap-2 font-semibold"><ScanLine className="size-4" /> Scan student QR</h2>
      {camera ? (
        <>
          <video ref={video} className="aspect-video w-full max-w-lg rounded-lg bg-zinc-900 object-contain" muted playsInline aria-label="QR scanner camera" />
          <Button variant="outline" onClick={() => { setCamera(false); setMessage("") }}>Stop camera</Button>
        </>
      ) : !review ? (
        <Button disabled={pending} onClick={() => { setMessage("Starting camera…"); setCamera(true) }}><Camera />Start camera</Button>
      ) : null}
      {review ? (
        <div className="space-y-3 rounded-lg border bg-background p-4">
          <p className="break-words text-lg font-semibold">{review.studentName}</p>
          <p className="text-sm">Confirm the person in front of you is this student. If unsure, check their school ID or verify their identity before accepting.</p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={pending} onClick={confirm}>Identity verified · Check in</Button>
            <Button disabled={pending} variant="outline" onClick={() => { setReview(null); setMessage("Check-in skipped.") }}>Skip check-in</Button>
          </div>
        </div>
      ) : null}
      <p role="status" className="text-sm">{message}</p>
    </section>
  )
}
