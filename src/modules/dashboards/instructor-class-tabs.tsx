"use client"

import { useEffect, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  instructorClassHref,
  instructorClassTabs,
  instructorSelectionForHash,
  resolveInstructorClassSelection,
  type InstructorClassSelection,
} from "./instructor-class-navigation"

export function InstructorClassTabs({ classSectionId, selection, basePath, actions }: {
  classSectionId: string
  selection: InstructorClassSelection
  basePath?: string
  actions?: ReactNode
}) {
  const router = useRouter()
  const href = (target: InstructorClassSelection, lessonId?: string) => {
    const original = instructorClassHref(classSectionId, target, lessonId)
    return basePath ? `${basePath}${original.slice(original.indexOf("?"))}` : original
  }
  useEffect(() => {
    function restoreHash() {
      const target = instructorSelectionForHash(window.location.hash)
      if (!target) return
      const lessonId = new URLSearchParams(window.location.search).get("lessonId") ?? undefined
      // Consume legacy hashes so a later menu selection cannot reopen the old section.
      const original = instructorClassHref(classSectionId, target, lessonId)
      router.replace(basePath ? `${basePath}${original.slice(original.indexOf("?"))}` : original, { scroll: false })
    }
    restoreHash()
    window.addEventListener("hashchange", restoreHash)
    return () => window.removeEventListener("hashchange", restoreHash)
  }, [basePath, classSectionId, router, selection])

  const views = selection.tab === "attendance"
    ? [{ id: "attendance", label: "Attendance" }, { id: "sessions", label: "Sessions" }]
    : selection.tab === "assessments"
      ? [{ id: "assignments", label: "Assignments" }, { id: "quizzes", label: "Quizzes" }, { id: "exams", label: "Exams" }]
      : []
  const linkClass = (active: boolean) => `flex min-h-11 shrink-0 items-center rounded-lg px-4 py-2 text-sm font-medium ${active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`

  return <div className="min-w-0 space-y-2">
    <nav aria-label="Class navigation" className="flex max-w-full gap-1 overflow-x-auto rounded-xl border bg-white p-1">
      {instructorClassTabs.map((tab) => <Link key={tab.id} href={href(resolveInstructorClassSelection(tab.id))} scroll={false} aria-current={selection.tab === tab.id ? "page" : undefined} className={linkClass(selection.tab === tab.id)}>{tab.label}</Link>)}
      {actions ? <div className="flex shrink-0 items-center gap-1 [&_button]:min-h-11 [&_button]:border-0 [&_button]:bg-transparent [&_button]:px-4 [&_button]:shadow-none">{actions}</div> : null}
    </nav>
    {views.length ? <nav aria-label={`${selection.tab === "attendance" ? "Attendance" : "Assessment"} sections`} className="flex max-w-full gap-1 overflow-x-auto">
      {views.map((view) => <Link key={view.id} href={href(resolveInstructorClassSelection(selection.tab, view.id))} scroll={false} aria-current={selection.view === view.id ? "page" : undefined} className={linkClass(selection.view === view.id)}>{view.label}</Link>)}
    </nav> : null}
  </div>
}
