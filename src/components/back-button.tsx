"use client"

import { ArrowLeft } from "lucide-react"

import { Button } from "@/components/ui/button"

export function BackButton({ className }: { className?: string }) {
  return (
    <Button
      aria-label="Go back"
      className={className}
      size="sm"
      type="button"
      variant="outline"
      onClick={() => window.history.back()}
    >
      <ArrowLeft />
      Back
    </Button>
  )
}
