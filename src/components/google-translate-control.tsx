"use client"

import { useEffect, useId, useRef, useState } from "react"
import { Languages } from "lucide-react"
import { cn } from "@/lib/utils"

declare global {
  interface Window {
    google?: { translate?: { TranslateElement?: new (options: Record<string, unknown>, elementId: string) => void } }
    googleTranslateElementInit?: () => void
  }
}

const options = [["en", "English"], ["ko", "한국어"], ["vi", "Tiếng Việt"], ["es", "Español"], ["ja", "日本語"], ["zh-CN", "中文"]] as const
let scriptReady: Promise<void> | null = null

function loadTranslator() {
  if (window.google?.translate?.TranslateElement) return Promise.resolve()
  if (scriptReady) return scriptReady
  scriptReady = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script")
    const timer = window.setTimeout(() => { script.remove(); scriptReady = null; reject(new Error("Translation unavailable")) }, 12000)
    window.googleTranslateElementInit = () => { window.clearTimeout(timer); resolve() }
    script.onerror = () => { window.clearTimeout(timer); script.remove(); scriptReady = null; reject(new Error("Translation unavailable")) }
    script.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"
    script.async = true
    document.body.appendChild(script)
  })
  return scriptReady
}

export function GoogleTranslateControl({ className }: { className?: string }) {
  const id = `translate_${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`
  const host = useRef<HTMLDivElement>(null)
  const requested = useRef("en")
  const [language, setLanguage] = useState("en")
  const [enabled, setEnabled] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    const value = document.cookie.split("; ").find((cookie) => cookie.startsWith("googtrans="))?.split("/").pop()
    if (value && options.some(([code]) => code === value)) {
      requested.current = value
      setLanguage(value)
      if (value !== "en") setEnabled(true)
    }
    const sync = (event: Event) => {
      const value = (event as CustomEvent<string>).detail
      requested.current = value
      setLanguage(value)
    }
    window.addEventListener("lms-language", sync)
    return () => window.removeEventListener("lms-language", sync)
  }, [])

  useEffect(() => {
    if (!enabled) return
    let disposed = false
    const element = host.current
    function apply() {
      const combo = element?.querySelector<HTMLSelectElement>(".goog-te-combo")
      if (combo && combo.value !== requested.current) {
        combo.value = requested.current
        combo.dispatchEvent(new Event("change", { bubbles: true }))
        document.documentElement.lang = requested.current
      }
    }
    const observer = new MutationObserver(apply)
    if (element) observer.observe(element, { childList: true, subtree: true })
    loadTranslator().then(() => {
      if (disposed || !element || !window.google?.translate?.TranslateElement) return
      if (!element.dataset.initialized) {
        new window.google.translate.TranslateElement({ autoDisplay: false, includedLanguages: options.map(([code]) => code).join(","), pageLanguage: "en" }, id)
        element.dataset.initialized = "true"
      }
      apply()
    }).catch(() => { if (!disposed) { setError("Translation unavailable. Select a language to retry."); setEnabled(false) } })
    return () => { disposed = true; observer.disconnect() }
  }, [enabled, id])

  function change(value: string) {
    requested.current = value
    setLanguage(value)
    setError("")
    document.cookie = `googtrans=/en/${value}; path=/; SameSite=Lax`
    window.dispatchEvent(new CustomEvent("lms-language", { detail: value }))
    const combo = host.current?.querySelector<HTMLSelectElement>(".goog-te-combo")
    if (combo) {
      combo.value = value
      combo.dispatchEvent(new Event("change", { bubbles: true }))
      document.documentElement.lang = value
    }
    setEnabled(true)
  }

  return <div className={cn("flex flex-wrap items-center gap-2 rounded-md border border-slate-700 bg-slate-900 p-2 text-slate-100", className)}>
    <Languages className="size-4 shrink-0" aria-hidden="true" />
    <select aria-label="Language" className="min-w-0 flex-1 rounded-md border border-slate-600 bg-slate-950 px-2 py-1 text-sm text-white" value={language} onChange={(event) => change(event.target.value)}>
      {options.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
    </select>
    <div id={id} ref={host} hidden aria-hidden="true" />
    {error ? <div className="w-full text-xs"><p role="status">{error}</p>
      <button type="button" className="min-h-11 underline" onClick={() => { setError(""); setEnabled(true) }}>Retry translation</button>
    </div> : null}
  </div>
}
