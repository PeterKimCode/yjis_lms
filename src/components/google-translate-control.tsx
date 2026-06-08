"use client"

import { useEffect } from "react"
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

export function GoogleTranslateControl({ className }: { className?: string }) {
  useEffect(() => {
    window.googleTranslateElementInit = () => {
      if (!window.google?.translate?.TranslateElement) return

      new window.google.translate.TranslateElement(
        {
          autoDisplay: false,
          includedLanguages: "en,ko,es,ja,zh-CN",
          pageLanguage: "en",
        },
        "google_translate_element"
      )
    }

    if (document.getElementById(GOOGLE_TRANSLATE_SCRIPT_ID)) {
      window.googleTranslateElementInit()
      return
    }

    const script = document.createElement("script")
    script.id = GOOGLE_TRANSLATE_SCRIPT_ID
    script.src =
      "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"
    script.async = true
    document.body.appendChild(script)
  }, [])

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
        id="google_translate_element"
      />
    </div>
  )
}
