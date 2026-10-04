"use client"

import { useSession } from "next-auth/react"
import { useEffect, useRef, useState, type RefObject } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { useRouter } from "next/navigation"
import { draftLifetime, draftPrefix } from "@/lib/browser-preferences"

type StoredDraft = { updatedAt: number; fields: Record<string, string | boolean>; extra: unknown; files: boolean }
type Options = {
  form: RefObject<HTMLFormElement | null>
  scope: string
  saved?: boolean
  getExtra?: () => unknown
  restoreExtra?: (extra: unknown) => void
}

export function useFormDraft(options: Options) {
  const router = useRouter()
  const { data: session } = useSession()
  const userId = session?.user?.id
  const key = userId ? `${draftPrefix}${encodeURIComponent(userId)}:${options.scope}` : null
  const current = useRef(options)
  const dirty = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cleared = useRef(false)
  const historyRestoring = useRef(false)
  const historyGuard = useRef(false)
  const [available, setAvailable] = useState<StoredDraft | null>(null)
  const [notice, setNotice] = useState("")
  const [leave, setLeave] = useState<(() => void) | null>(null)
  useEffect(() => { current.current = options })

  useEffect(() => {
    if (!key) return
    const form = current.current.form.current
    if (!form) return
    cleared.current = false
    let awaitingRestore = false
    try {
      const raw = localStorage.getItem(key)
      if (raw) {
        const draft = JSON.parse(raw) as StoredDraft
        if (Number.isFinite(draft.updatedAt) && draft.updatedAt <= Date.now() && draft.updatedAt > Date.now() - draftLifetime && draft.fields && typeof draft.fields === "object" && !Array.isArray(draft.fields) && Object.values(draft.fields).every((value) => typeof value === "string" || typeof value === "boolean")) {
          awaitingRestore = true
          queueMicrotask(() => setAvailable(draft))
        } else localStorage.removeItem(key)
      }
    } catch { queueMicrotask(() => setNotice("Temporary saving is unavailable in this browser. Leave warnings are still enabled.")) }
    function snapshot() {
      if (!dirty.current || cleared.current || awaitingRestore) return
      const fields: StoredDraft["fields"] = {}
      let files = false
      for (const element of Array.from(form!.elements)) {
        if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement)) continue
        if (element instanceof HTMLInputElement && element.type === "file") { files ||= Boolean(element.files?.length); continue }
        if (!element.name || element.type === "hidden" || element.type === "password" || element.type === "radio") continue
        fields[element.name] = element instanceof HTMLInputElement && element.type === "checkbox" ? element.checked : element.value
      }
      try {
        localStorage.setItem(key!, JSON.stringify({ updatedAt: Date.now(), fields, extra: current.current.getExtra?.(), files }))
        setNotice(files ? "Saved temporarily on this device. Choose local files again after restoring." : "Saved temporarily on this device. Not published.")
      } catch { setNotice("Could not save temporarily. Keep this page open and use Save.") }
    }
    function changed() {
      cleared.current = false
      dirty.current = true
      if (!historyGuard.current) {
        // A same-URL entry lets Back reach the guard before Next unmounts this form.
        window.history.pushState({ ...window.history.state, lmsDraftGuard: key }, "", window.location.href)
        historyGuard.current = true
      }
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(snapshot, 1000)
    }
    function confirmLeave(proceed: () => void) {
      if (!dirty.current) { proceed(); return }
      snapshot()
      setLeave(() => () => { dirty.current = false; proceed() })
    }
    function dialogLeave(event: Event) {
      if (!dirty.current) return
      event.preventDefault()
      confirmLeave((event as CustomEvent<{ proceed: () => void }>).detail.proceed)
    }
    function beforeUnload(event: BeforeUnloadEvent) {
      if (!dirty.current) return
      snapshot()
      event.preventDefault(); event.returnValue = ""
    }
    function click(event: MouseEvent) {
      const link = (event.target as Element)?.closest<HTMLAnchorElement>("a[href]")
      if (!link || link.target === "_blank" || link.hasAttribute("download") || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.defaultPrevented) return
      if (link.href === window.location.href || link.getAttribute("href")?.startsWith("#")) return
      if (dirty.current) {
        event.preventDefault(); event.stopPropagation()
        confirmLeave(() => { const destination = new URL(link.href); if (destination.origin === window.location.origin) router.push(destination.pathname + destination.search + destination.hash); else window.location.assign(link.href) })
      }
    }
    function pop(event: PopStateEvent) {
      if (event.state?.lmsDraftGuard === key) { historyRestoring.current = false; return }
      if (historyRestoring.current) { historyRestoring.current = false; return }
      if (dirty.current) { event.stopImmediatePropagation(); historyRestoring.current = true; window.history.forward(); confirmLeave(() => window.history.go(historyGuard.current ? -2 : -1)) }
    }
    function clear() {
      cleared.current = true; dirty.current = false
      if (timer.current) clearTimeout(timer.current)
    }
    function storageChanged(event: StorageEvent) { if (event.key === key && event.newValue === null) clear() }
    function resolved() { awaitingRestore = false }
    form.addEventListener("input", changed)
    form.addEventListener("change", changed)
    form.addEventListener("lms-draft-change", changed)
    form.addEventListener("lms-draft-resolved", resolved)
    form.addEventListener("lms-confirm-leave", dialogLeave)
    document.addEventListener("click", click, true)
    window.addEventListener("beforeunload", beforeUnload)
    window.addEventListener("popstate", pop, true)
    window.addEventListener("lms-clear-drafts", clear)
    window.addEventListener("storage", storageChanged)
    return () => {
      snapshot()
      if (timer.current) clearTimeout(timer.current)
      form.removeEventListener("input", changed); form.removeEventListener("change", changed)
      form.removeEventListener("lms-draft-change", changed); form.removeEventListener("lms-draft-resolved", resolved)
      form.removeEventListener("lms-confirm-leave", dialogLeave)
      document.removeEventListener("click", click, true)
      window.removeEventListener("beforeunload", beforeUnload); window.removeEventListener("popstate", pop, true)
      window.removeEventListener("lms-clear-drafts", clear)
      window.removeEventListener("storage", storageChanged)
    }
  }, [key, router])

  function markChanged() { current.current.form.current?.dispatchEvent(new Event("lms-draft-change")) }
  function clear() {
    cleared.current = true; dirty.current = false
    if (timer.current) clearTimeout(timer.current)
    try { if (key) localStorage.removeItem(key) } catch { /* Already explained by the notice. */ }
  }
  useEffect(() => { if (options.saved) clear() }, [options.saved, key]) // eslint-disable-line react-hooks/exhaustive-deps
  function restore() {
    if (!available) return
    const form = current.current.form.current
    if (!form) return
    current.current.restoreExtra?.(available.extra)
    requestAnimationFrame(() => {
    for (const [name, value] of Object.entries(available.fields)) {
      const element = form.elements.namedItem(name)
      if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) || element.disabled || ["hidden", "file", "password", "radio"].includes(element.type)) continue
      if (element instanceof HTMLInputElement && element.type === "checkbox") element.checked = value === true
      else {
        if (element instanceof HTMLSelectElement && !Array.from(element.options).some((option) => option.value === value)) continue
        element.value = String(value)
      }
    }
    setAvailable(null)
    form.dispatchEvent(new Event("lms-draft-resolved"))
    markChanged()
    setNotice(available.files ? "Restored. Choose local files again before saving." : "Restored. Review your changes, then Save.")
    })
  }
  function discard() {
    clear(); cleared.current = false
    setAvailable(null); setNotice("Temporary copy discarded.")
    current.current.form.current?.dispatchEvent(new Event("lms-draft-resolved"))
  }
  return { available: Boolean(available), notice, restore, discard, markChanged, clear, leave: Boolean(leave), stay: () => { historyRestoring.current = false; setLeave(null) }, confirmLeave: () => { historyRestoring.current = false; leave?.(); setLeave(null) } }
}

export function DraftNotice({ draft }: { draft: ReturnType<typeof useFormDraft> }) {
  return <><div className="col-span-full min-w-0" aria-live="polite">
    {draft.available ? <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"><span>A temporary copy is available on this device. Restore it?</span><Button type="button" size="sm" onClick={draft.restore}>Restore</Button><Button type="button" size="sm" variant="outline" onClick={draft.discard}>Discard</Button></div> : draft.notice ? <p className="text-sm text-slate-600">{draft.notice}</p> : null}
  </div>
    <Dialog open={draft.leave} onOpenChange={(open) => { if (!open) draft.stay() }}>
      <DialogContent>
        <DialogTitle>Leave without saving?</DialogTitle>
        <DialogDescription>Your changes have not been saved to the LMS. A temporary copy stays on this device when browser storage is available.</DialogDescription>
        <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" onClick={draft.stay}>Stay</Button><Button type="button" onClick={draft.confirmLeave}>Leave</Button></div>
      </DialogContent>
    </Dialog>
  </>
}
