"use client"

import { useFormStatus } from "react-dom"

import { Button } from "@/components/ui/button"

type DeleteAction = (formData: FormData) => void | Promise<void>

export function ConfirmDeleteForm({
  action,
  entity,
  id,
  label = "Delete",
  message,
  returnPath,
}: {
  action: DeleteAction
  entity: string
  id: string
  label?: string
  message: string
  returnPath: string
}) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(message)) {
          event.preventDefault()
        }
      }}
    >
      <input name="entity" type="hidden" value={entity} />
      <input name="id" type="hidden" value={id} />
      <input name="returnPath" type="hidden" value={returnPath} />
      <DeleteSubmit label={label} />
    </form>
  )
}

function DeleteSubmit({ label }: { label: string }) {
  const { pending } = useFormStatus()

  return (
    <Button disabled={pending} size="sm" type="submit" variant="destructive">
      {pending ? "Deleting..." : label}
    </Button>
  )
}
