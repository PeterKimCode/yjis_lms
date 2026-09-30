"use client"
import { useRef, useState, type FormEvent } from "react"
export function useAssessmentSave<
  T extends {
    ok: boolean
    message: string
    fieldErrors?: Record<string, string>
  }
>(action: (state: T, data: FormData) => Promise<T>, initial: T) {
  const [state, setState] = useState(initial),
    [pending, setPending] = useState(false),
    lock = useRef(false)
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (lock.current) return
    const form = event.currentTarget,
      data = new FormData(form)
    lock.current = true
    setPending(true)
    try {
      const result = await action(initial, data)
      setState(result)
      if (result.fieldErrors) {
        const field = form.elements.namedItem(
          Object.keys(result.fieldErrors)[0]
        ) as HTMLElement | null
        const details = field?.closest("details")
        if (details) details.open = true
        field?.focus()
      }
    } catch {
      setState({
        ...initial,
        ok: false,
        message:
          "Could not save. Your changes are still here. Please try again."
      })
    } finally {
      lock.current = false
      setPending(false)
    }
  }
  return { state, pending, onSubmit }
}
