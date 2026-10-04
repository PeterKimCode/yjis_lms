"use client"

import { useSyncExternalStore, type ReactNode } from "react"

function subscribe(callback: () => void) {
  const query = window.matchMedia("(max-width: 767px)")
  query.addEventListener("change", callback)
  return () => query.removeEventListener("change", callback)
}
// Render a single layout: hidden duplicate forms would mount duplicate dialogs.
export function ResponsiveTable({ mobile, children }: { mobile: ReactNode; children: ReactNode }) {
  const small = useSyncExternalStore(subscribe, () => window.matchMedia("(max-width: 767px)").matches, () => false)
  return small ? mobile : children
}
