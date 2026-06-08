"use client"

import { useEffect, useId } from "react"
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

export function GoogleTranslateControl({ className }: { className?: string }) {
  const elementId = `google_translate_${useId().replace(/:/g, "")}`

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
              includedLanguages: "en,ko,es,ja,zh-CN",
              pageLanguage: "en",
            },
            element.id
          )
        })
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
        className="google-translate-widget"
        data-translate-widget="true"
        id={elementId}
      />
    </div>
  )
}
