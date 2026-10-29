"use client"
import { startTransition, useActionState, type ReactNode } from "react"
import type { CatalogState } from "./actions"
export function CatalogForm({ action, children }: { action: (state: CatalogState, form: FormData) => Promise<CatalogState>; children: ReactNode }) {
  const [state, submit, pending] = useActionState(action, { ok: false, message: "" })
  return <form action={submit} onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget, (event.nativeEvent as SubmitEvent).submitter); startTransition(() => submit(data)) }} className="space-y-3"><fieldset disabled={pending} className="min-w-0 space-y-3 disabled:opacity-60">{children}</fieldset>{state.message ? <p role="status" className={`text-sm ${state.ok ? "text-emerald-800" : "text-red-700"}`}>{state.message}</p> : null}{pending ? <p role="status" className="text-sm">Saving…</p> : null}</form>
}
