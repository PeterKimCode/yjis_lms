"use client"

import { FriendlyError } from "@/components/friendly-error"

export default function ParentError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  return (
    <FriendlyError
      error={error}
      title="Parent page could not load"
      unstable_retry={unstable_retry}
    />
  )
}
