"use client"

import { HelpTooltip } from "@/components/help-tooltip"

import { useMemo, useState } from "react"

import { Button } from "@/components/ui/button"

type Option = { id: string; label: string }
type CampusOption = Option & { organizationId: string }

export function PolicyScopeSelector({
  campusOptions,
  organizationOptions,
  selectedCampusId,
  selectedOrganizationId,
}: {
  campusOptions: CampusOption[]
  organizationOptions: Option[]
  selectedCampusId: string | null
  selectedOrganizationId: string
}) {
  const [organizationId, setOrganizationId] = useState(selectedOrganizationId)
  const [campusId, setCampusId] = useState(selectedCampusId ?? "")
  const filteredCampusOptions = useMemo(
    () =>
      campusOptions.filter((campus) => campus.organizationId === organizationId),
    [campusOptions, organizationId]
  )

  function handleOrganizationChange(value: string) {
    setOrganizationId(value)
    if (!campusOptions.some((campus) => campus.id === campusId && campus.organizationId === value)) {
      setCampusId("")
    }
  }

  return (
    <form
      action="/admin/policies"
      className="grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-3"
    >
      <label className="grid gap-1 text-sm">
        <span className="font-medium lms-help-heading">Organization<HelpTooltip>Choose the organization policy scope.</HelpTooltip></span>
        <select
          className="h-9 rounded-md border bg-background px-3 text-sm"
          name="organizationId"
          value={organizationId}
          onChange={(event) => handleOrganizationChange(event.target.value)}
          required
        >
          {organizationOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        <span className="font-medium lms-help-heading">Campus<HelpTooltip>Select a campus override or leave blank for the organization default.</HelpTooltip></span>
        <select
          className="h-9 rounded-md border bg-background px-3 text-sm"
          name="campusId"
          value={campusId}
          onChange={(event) => setCampusId(event.target.value)}
        >
          <option value="">None / Organization default</option>
          {filteredCampusOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-end">
        <Button size="sm" type="submit" variant="outline">
          Change scope
        </Button>
      </div>
    </form>
  )
}

