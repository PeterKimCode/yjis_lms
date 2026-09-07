"use client"

import { useState } from "react"
import { saveLesson } from "./actions"
import { useRouter } from "next/navigation"

export function BulkLessonUpload({ classSectionId }: { classSectionId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<string[]>([])
  async function upload(files: File[]) {
    if (busy) return
    setBusy(true)
    setResults([])
    for (const file of files) {
      try {
        const body = new FormData()
        body.set("classSectionId", classSectionId)
        body.set("lessonFile", file)
        const response = await fetch("/api/learning/lesson-file-upload", { method: "POST", body })
        const uploaded = await response.json()
        if (!response.ok) throw new Error(uploaded.error ?? "Upload failed")
        const lesson = new FormData()
        lesson.set("classSectionId", classSectionId)
        lesson.set("title", file.name.replace(/\.[^.]+$/, ""))
        lesson.set("contentType", "FILE")
        lesson.set("videoFileAssetId", uploaded.fileAsset.id)
        const saved = await saveLesson({ ok: false, message: "" }, lesson)
        if (!saved.ok) throw new Error(`${saved.message} File is available in uploaded files.`)
        setResults((previous) => [...previous, `${file.name}: Draft created`])
      } catch (error) {
        setResults((previous) => [...previous, `${file.name}: ${error instanceof Error ? error.message : "Upload failed"}`])
      }
    }
    setBusy(false)
    router.refresh()
  }
  return <div className="space-y-3">
    <label className="block rounded-lg border-2 border-dashed p-6" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void upload(Array.from(event.dataTransfer.files)) }}>
      <span className="mb-3 block">Lesson files (20 MB per file)</span>
      <input type="file" multiple disabled={busy} accept=".pdf,.ppt,.pptx,.doc,.docx,.xls,.xlsx,.txt,.md,.csv,.png,.jpg,.jpeg,.webp,.gif,.zip" onChange={(event) => { void upload(Array.from(event.target.files ?? [])); event.target.value = "" }} />
    </label>
    {busy ? <p role="status">Uploading and creating drafts...</p> : null}
    <ul aria-live="polite" className="space-y-2 text-sm break-words">{results.map((result, index) => <li key={index}>{result}</li>)}</ul>
  </div>
}
