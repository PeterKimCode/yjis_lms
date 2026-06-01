"use client"

import { useMemo, useState } from "react"

type Option = {
  id: string
  label: string
}

export function SearchableSelect({
  label,
  name,
  options,
  required,
  searchPlaceholder,
}: {
  label: string
  name: string
  options: Option[]
  required?: boolean
  searchPlaceholder?: string
}) {
  const [query, setQuery] = useState("")
  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return options

    return options.filter((option) =>
      option.label.toLowerCase().includes(normalized)
    )
  }, [options, query])

  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium">{label}</span>
      <input
        className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
        onChange={(event) => setQuery(event.target.value)}
        placeholder={searchPlaceholder ?? `Search ${label.toLowerCase()}...`}
        type="search"
        value={query}
      />
      <select
        className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
        name={name}
        required={required}
      >
        {filteredOptions.length ? (
          filteredOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))
        ) : (
          <option value="">No matches</option>
        )}
      </select>
    </label>
  )
}
