"use client"

import { useEffect, useId, useState } from "react"
import { Languages } from "lucide-react"

import { cn } from "@/lib/utils"

declare global {
  interface Window {
    google?: {
      translate?: {
        TranslateElement?: new (
          options: Record<string, unknown>,
          elementId: string
        ) => void
      }
    }
    googleTranslateElementInit?: () => void
  }
}

const GOOGLE_TRANSLATE_SCRIPT_ID = "google-translate-element-script"
const GOOGLE_TRANSLATE_WIDGET_SELECTOR = ".google-translate-widget[data-translate-widget='true']"
const includedLanguages = "en,ko,vi,es,ja,zh-CN"
const languageOptions = [
  ["", "Select language"],
  ["en", "English"],
  ["ko", "Korean"],
  ["vi", "Vietnamese"],
  ["es", "Spanish"],
  ["ja", "Japanese"],
  ["zh-CN", "Chinese"],
] as const

export function GoogleTranslateControl({ className }: { className?: string }) {
  const elementId = `google_translate_${useId().replace(/:/g, "")}`
  const [hasGoogleSelect, setHasGoogleSelect] = useState(false)

  useEffect(() => {
    function initializeWidgets() {
      if (!window.google?.translate?.TranslateElement) return

      document
        .querySelectorAll<HTMLElement>(GOOGLE_TRANSLATE_WIDGET_SELECTOR)
        .forEach((element) => {
          if (!element.id || element.dataset.initialized === "true") return

          element.dataset.initialized = "true"

          new window.google!.translate!.TranslateElement!(
            {
              autoDisplay: false,
              includedLanguages,
              pageLanguage: "en",
            },
            element.id
          )
        })

      window.setTimeout(() => {
        setHasGoogleSelect(
          Boolean(document.querySelector(`#${CSS.escape(elementId)} .goog-te-combo`))
        )
      }, 500)
    }

    window.googleTranslateElementInit = initializeWidgets

    if (document.getElementById(GOOGLE_TRANSLATE_SCRIPT_ID)) {
      initializeWidgets()
      return
    }

    const script = document.createElement("script")
    script.id = GOOGLE_TRANSLATE_SCRIPT_ID
    script.src =
      "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"
    script.async = true
    document.body.appendChild(script)
  }, [elementId])

  function changeLanguage(language: string) {
    const combo = document.querySelector<HTMLSelectElement>(
      `#${CSS.escape(elementId)} .goog-te-combo`
    )

    if (combo) {
      combo.value = language
      combo.dispatchEvent(new Event("change"))
      return
    }

    document.cookie = `googtrans=/en/${language || "en"}; path=/`
    document.cookie = `googtrans=/en/${language || "en"}; path=/; domain=${window.location.hostname}`
    window.location.reload()
  }

  return (
    <div
      className={cn(
        "flex min-h-8 items-center gap-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200",
        className
      )}
    >
      <Languages className="h-3.5 w-3.5" />
      <div
        aria-label="Google Translate"
        className={cn("google-translate-widget", !hasGoogleSelect && "sr-only")}
        data-translate-widget="true"
        id={elementId}
      />
      {!hasGoogleSelect ? (
        <select
          aria-label="Translate language"
          className="h-7 min-w-32 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100 outline-none"
          defaultValue=""
          onChange={(event) => changeLanguage(event.target.value)}
        >
          {languageOptions.map(([value, label]) => (
            <option key={value || "default"} value={value}>
              {label}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  )
}
