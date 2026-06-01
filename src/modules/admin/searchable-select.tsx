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
  const [selectedId, setSelectedId] = useState(options[0]?.id ?? "")
  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return options

    return options.filter((option) =>
      option.label.toLowerCase().includes(normalized)
    )
  }, [options, query])

  const visibleOptions = filteredOptions.length ? filteredOptions : options

  return (
    <div className="grid gap-2 text-sm">
      <label className="grid gap-1">
        <span className="font-medium">{label}</span>
        <input
          className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
          onChange={(event) => setQuery(event.target.value)}
          placeholder={searchPlaceholder ?? `Search ${label.toLowerCase()}...`}
          type="search"
          value={query}
        />
      </label>
      <input name={name} type="hidden" value={selectedId} />
      <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border bg-background p-1">
        {visibleOptions.length ? (
          visibleOptions.map((option) => {
            const checked = selectedId === option.id

            return (
              <label
                className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-100 ${
                  checked ? "bg-primary/10 font-medium text-primary" : ""
                }`}
                key={option.id}
              >
                <input
                  checked={checked}
                  className="size-3.5"
                  onChange={() => setSelectedId(option.id)}
                  required={required}
                  type="radio"
                />
                <span>{option.label}</span>
              </label>
            )
          })
        ) : (
          <p className="px-2 py-1.5 text-sm text-muted-foreground">
            No available options
          </p>
        )}
      </div>
      {query && filteredOptions.length === 0 && options.length ? (
        <p className="text-xs text-muted-foreground">
          No exact matches. Showing all available options.
        </p>
      ) : null}
    </div>
  )
}
