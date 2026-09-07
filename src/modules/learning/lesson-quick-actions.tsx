"use client"

import { useState } from "react"
import { Copy } from "lucide-react"
import { updateLessonQuickly } from "./actions"

export function LessonQuickActions({ classSectionId, lessonId, published, duplicate = false }: {
  classSectionId: string; lessonId: string; published: boolean; duplicate?: boolean
}) {
  const [pending, setPending] = useState(false)
  async function run() {
    setPending(true)
    try {
      await updateLessonQuickly(classSectionId, lessonId, duplicate ? "duplicate" : "publish", !published)
      window.dispatchEvent(new CustomEvent("lms-toast", { detail: { message: duplicate ? "Lesson copied as draft." : "Publication updated.", tone: "success" } }))
    } catch {
      window.dispatchEvent(new CustomEvent("lms-toast", { detail: { message: "Could not save. Please try again.", tone: "error" } }))
    } finally { setPending(false) }
  }
  return duplicate ? <button type="button" title="Duplicate lesson" aria-label="Duplicate lesson" disabled={pending} onClick={run} className="ml-2 rounded border p-2"><Copy className="size-4" /></button> :
    <label className="flex items-center gap-2 whitespace-nowrap"><input type="checkbox" role="switch" checked={published} disabled={pending} onChange={run} />{published ? "Published" : "Draft"}</label>
}
