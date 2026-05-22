"use client"

import { ArrowLeft } from "lucide-react"

import { Button } from "@/components/ui/button"

export function BackButton() {
  return (
    <Button
      aria-label="Go back"
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
