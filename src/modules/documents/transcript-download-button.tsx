"use client"

import { useState } from "react"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"

function getFilename(disposition: string | null) {
  const match = disposition?.match(/filename="([^"]+)"/)
  return match?.[1] ?? "transcript.pdf"
}

export function TranscriptDownloadButton({
  children = "Download transcript",
  studentId,
  variant = "outline",
}: {
  children?: ReactNode
  studentId: string
  variant?: "default" | "outline"
}) {
  const [message, setMessage] = useState("")
  const [isDownloading, setIsDownloading] = useState(false)

  async function downloadTranscript() {
    setIsDownloading(true)
    setMessage("")

    try {
      const response = await fetch(`/api/documents/transcript?studentId=${studentId}`)

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string
        } | null
        setMessage(
          data?.error ??
            "Transcript could not be downloaded. Please try again later."
        )
        return
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = getFilename(response.headers.get("Content-Disposition"))
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <>
      <Button
        onClick={downloadTranscript}
        size="sm"
        type="button"
        variant={variant}
        disabled={isDownloading}
      >
        {isDownloading ? "Downloading..." : children}
      </Button>
      {message ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 px-4">
          <div className="w-full max-w-sm rounded-xl border bg-background p-5 shadow-xl">
            <h2 className="text-base font-semibold">Transcript unavailable</h2>
            <p className="mt-2 text-sm text-muted-foreground">{message}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              You can try again tomorrow, or ask the school office for help.
            </p>
            <div className="mt-4 flex justify-end">
              <Button size="sm" type="button" onClick={() => setMessage("")}>
                OK
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
