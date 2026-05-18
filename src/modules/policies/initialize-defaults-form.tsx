"use client"

import { useActionState } from "react"

import { Button } from "@/components/ui/button"
import {
  initialPolicyActionState,
  type PolicyActionState,
} from "@/modules/policies/action-state"
import { initializeMissingPolicyDefaults } from "@/modules/policies/actions"

export function InitializeDefaultsForm({
  campusId,
  organizationId,
}: {
  campusId: string | null
  organizationId: string
}) {
  const [state, formAction, pending] = useActionState<
    PolicyActionState,
    FormData
  >(initializeMissingPolicyDefaults, initialPolicyActionState)

  return (
    <form
      action={formAction}
      className="flex flex-col gap-2 rounded-lg border bg-background p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="space-y-1">
        <p className="text-sm font-medium">Initialize missing defaults</p>
        <p className="text-xs text-muted-foreground">
          Creates missing policy records for this scope without overwriting
          customized values.
        </p>
        {state.message ? (
          <p
            className={`text-xs ${state.ok ? "text-muted-foreground" : "text-destructive"}`}
            role="status"
          >
            {state.message}
          </p>
        ) : null}
      </div>
      <input name="organizationId" type="hidden" value={organizationId} />
      <input name="campusId" type="hidden" value={campusId ?? ""} />
      <Button size="sm" type="submit" disabled={pending}>
        {pending ? "Initializing..." : "Initialize missing defaults"}
      </Button>
    </form>
  )
}
