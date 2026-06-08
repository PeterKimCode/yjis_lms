"use client"

import { ArrowLeft } from "lucide-react"

import { Button } from "@/components/ui/button"

export function BackButton({
  className,
  showLabel = true,
}: {
  className?: string
  showLabel?: boolean
}) {
  return (
    <Button
      aria-label="Go back"
      className={className}
      size={showLabel ? "sm" : "icon-sm"}
      type="button"
      variant="outline"
      onClick={() => window.history.back()}
    >
      <ArrowLeft />
      {showLabel ? "Back" : <span className="sr-only">Back</span>}
    </Button>
  )
}
