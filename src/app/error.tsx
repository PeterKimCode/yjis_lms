"use client"

import { FriendlyError } from "@/components/friendly-error"

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  return (
    <FriendlyError
      error={error}
      title="We could not load this page"
      unstable_retry={unstable_retry}
    />
  )
}
