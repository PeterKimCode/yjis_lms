"use client"

import { usePathname } from "next/navigation"
import type { ReactNode } from "react"

export function NavigationVisibility({ children }: { children: ReactNode }) {
  return usePathname() === "/login" ? null : children
}
