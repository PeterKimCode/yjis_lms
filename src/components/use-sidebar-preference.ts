"use client"

import { useSession } from "next-auth/react"
import { useSyncExternalStore } from "react"

const eventName = "lms-sidebar-preference"
const fallback = new Map<string, boolean>()
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback)
  window.addEventListener(eventName, callback)
  return () => {
    window.removeEventListener("storage", callback)
    window.removeEventListener(eventName, callback)
  }
}
export function useSidebarPreference() {
  const { data: session } = useSession()
  const key = session?.user?.id ? `lms:sidebar:${encodeURIComponent(session.user.id)}` : null
  const collapsed = useSyncExternalStore(subscribe, () => {
    if (!key) return false
    if (fallback.has(key)) return fallback.get(key) ?? false
    try { return localStorage.getItem(key) === "collapsed" } catch { return false }
  }, () => false)
  function toggle() {
    if (!key) return
    try { localStorage.setItem(key, collapsed ? "expanded" : "collapsed"); fallback.delete(key) } catch { fallback.set(key, !collapsed) }
    window.dispatchEvent(new Event(eventName))
  }
  return [collapsed, toggle] as const
}
