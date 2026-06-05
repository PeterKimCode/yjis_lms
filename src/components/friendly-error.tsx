"use client"

import { useEffect } from "react"

import { Button } from "@/components/ui/button"

export function FriendlyError({
  error,
  title = "Something went wrong",
  unstable_retry,
}: {
  error: Error & { digest?: string }
  title?: string
  unstable_retry: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="app-shell-surface flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <section className="lms-soft-panel max-w-lg space-y-4 rounded-2xl p-6 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-xl font-semibold text-amber-700">
          !
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="text-sm text-muted-foreground">
            The page could not finish loading. Please try again, go back, or
            contact an administrator if this keeps happening.
          </p>
          {error.digest ? (
            <p className="text-xs text-muted-foreground">
              Error reference: {error.digest}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button type="button" onClick={() => unstable_retry()}>
            Try again
          </Button>
          <Button type="button" variant="outline" onClick={() => history.back()}>
            Back
          </Button>
        </div>
      </section>
    </main>
  )
}
