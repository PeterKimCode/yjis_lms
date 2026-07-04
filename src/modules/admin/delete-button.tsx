"use client"

import { useRef, useState } from "react"
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
  const formRef = useRef<HTMLFormElement>(null)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [isConfirmed, setIsConfirmed] = useState(false)

  function submitConfirmedDelete() {
    setIsConfirmed(true)
    setIsConfirmOpen(false)
    window.setTimeout(() => formRef.current?.requestSubmit(), 0)
  }

  return (
    <>
      <form
        ref={formRef}
        action={action}
        onSubmit={(event) => {
          if (isConfirmed) {
            return
          }

          event.preventDefault()
          setIsConfirmOpen(true)
        }}
      >
        <input name="entity" type="hidden" value={entity} />
        <input name="id" type="hidden" value={id} />
        <input name="returnPath" type="hidden" value={returnPath} />
        <DeleteSubmit label={label} />
      </form>

      {isConfirmOpen ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 px-4"
          role="dialog"
        >
          <div className="w-full max-w-md rounded-xl border bg-background p-5 shadow-2xl">
            <div className="space-y-2">
              <p className="text-base font-semibold">Delete this item?</p>
              <p className="text-sm text-muted-foreground">{message}</p>
              <p className="text-xs text-destructive">
                This action can remove data permanently if there are no related records blocking deletion.
              </p>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button size="sm" type="button" variant="outline" onClick={() => setIsConfirmOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" type="button" variant="destructive" onClick={submitConfirmedDelete}>
                Confirm delete
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
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
