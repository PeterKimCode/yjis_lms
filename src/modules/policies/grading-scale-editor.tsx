"use client"

import { useActionState, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  initialPolicyActionState,
  type PolicyActionState,
} from "@/modules/policies/action-state"
import { saveGradingScale } from "@/modules/policies/actions"
import type { SerializedGradingScale } from "@/modules/policies/types"

type Row = SerializedGradingScale["items"][number]

export function GradingScaleEditor({
  organizationId,
  scale,
}: {
  organizationId: string
  scale: SerializedGradingScale
}) {
  const [rows, setRows] = useState<Row[]>(scale.items)
  const [state, formAction, pending] = useActionState(
    saveGradingScale,
    initialPolicyActionState
  )
  const rangeWarning = getRangeWarning(rows)

  return (
    <form action={formAction} className="space-y-4">
      <input name="id" type="hidden" value={scale.id} />
      <input name="organizationId" type="hidden" value={organizationId} />
      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Scale name</span>
          <Input name="name" required defaultValue={scale.name} />
        </label>
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Description</span>
          <Input name="description" defaultValue={scale.description ?? ""} />
        </label>
      </div>
      {rangeWarning ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {rangeWarning}
        </p>
      ) : null}
      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-[820px] w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="p-2">Letter grade</th>
              <th className="p-2">Min score</th>
              <th className="p-2">Max score</th>
              <th className="p-2">Grade point</th>
              <th className="p-2">Passing</th>
              <th className="p-2">Remove</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr className="border-t" key={`${row.id}-${index}`}>
                <td className="p-2">
                  <input name={`rows[${index}][id]`} type="hidden" value={row.id} />
                  <Input
                    name={`rows[${index}][label]`}
                    required
                    placeholder="A+"
                    defaultValue={row.label}
                  />
                </td>
                <td className="p-2">
                  <Input
                    inputMode="decimal"
                    max="100"
                    min="0"
                    name={`rows[${index}][minPercentage]`}
                    step="0.01"
                    type="number"
                    defaultValue={row.minPercentage}
                  />
                </td>
                <td className="p-2">
                  <Input
                    inputMode="decimal"
                    max="100"
                    min="0"
                    name={`rows[${index}][maxPercentage]`}
                    step="0.01"
                    type="number"
                    defaultValue={row.maxPercentage}
                  />
                </td>
                <td className="p-2">
                  <Input
                    inputMode="decimal"
                    min="0"
                    name={`rows[${index}][gradePoint]`}
                    step="0.01"
                    type="number"
                    defaultValue={row.gradePoint}
                  />
                </td>
                <td className="p-2">
                  <label className="flex items-center gap-2">
                    <input
                      name={`rows[${index}][isPassing]`}
                      type="checkbox"
                      defaultChecked={row.isPassing}
                    />
                    Passing
                  </label>
                </td>
                <td className="p-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setRows((current) => current.filter((_, rowIndex) => rowIndex !== index))}
                  >
                    Delete
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() =>
            setRows((current) => [
              ...current,
              {
                id: "",
                label: "",
                minPercentage: "0",
                maxPercentage: "0",
                gradePoint: "0",
                isPassing: true,
              },
            ])
          }
        >
          Add scale row
        </Button>
        <Button size="sm" type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save grading scale"}
        </Button>
        <ActionMessage state={state} />
      </div>
    </form>
  )
}

function ActionMessage({ state }: { state: PolicyActionState }) {
  return state.message ? (
    <p
      className={`text-sm ${state.ok ? "text-muted-foreground" : "text-destructive"}`}
      role="status"
    >
      {state.message}
    </p>
  ) : null
}

function getRangeWarning(rows: Row[]) {
  const ranges = rows
    .map((row) => ({
      min: Number(row.minPercentage),
      max: Number(row.maxPercentage),
    }))
    .filter((row) => Number.isFinite(row.min) && Number.isFinite(row.max))
    .sort((a, b) => a.min - b.min)

  if (!ranges.length) return null
  if (ranges.some((row) => row.min > row.max)) {
    return "Min score must be less than or equal to max score."
  }
  for (let index = 1; index < ranges.length; index += 1) {
    if (ranges[index - 1].max >= ranges[index].min) {
      return "Scale ranges cannot overlap."
    }
  }
  if (ranges[0].min > 0 || ranges[ranges.length - 1].max < 100) {
    return "Scale should cover scores from 0 to 100."
  }
  return null
}

