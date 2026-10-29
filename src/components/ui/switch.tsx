import type { ComponentProps } from "react"
import { cn } from "@/lib/utils"

// Keep native checkbox form values, reset behavior, and change events.
export function Switch({ className, ...props }: Omit<ComponentProps<"input">, "type" | "role">) {
  return <input {...props} type="checkbox" role="switch" className={cn("lms-switch", className)} />
}
