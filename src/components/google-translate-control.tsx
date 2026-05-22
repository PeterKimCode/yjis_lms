"use client"

import { Languages } from "lucide-react"

const languages = [
  ["", "Translate"],
  ["ko", "Korean"],
  ["en", "English"],
  ["es", "Spanish"],
  ["ja", "Japanese"],
  ["zh-CN", "Chinese"],
] as const

export function GoogleTranslateControl() {
  function handleChange(value: string) {
    if (!value) return

    const target = new URL("https://translate.google.com/translate")
    target.searchParams.set("sl", "auto")
    target.searchParams.set("tl", value)
    target.searchParams.set("u", window.location.href)
    window.open(target.toString(), "_blank", "noopener,noreferrer")
  }

  return (
    <label className="hidden items-center gap-1 rounded-md border bg-white px-2 py-1 text-xs text-muted-foreground sm:flex">
      <Languages className="h-3.5 w-3.5" />
      <select
        aria-label="Google Translate"
        className="bg-transparent text-xs outline-none"
        defaultValue=""
        onChange={(event) => handleChange(event.target.value)}
      >
        {languages.map(([value, label]) => (
          <option key={value || "default"} value={value}>
            {label}
          </option>
        ))}
      </select>
    </label>
  )
}
