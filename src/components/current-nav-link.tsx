"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ComponentProps } from "react"

export function CurrentNavLink({ exact = false, ...props }: ComponentProps<typeof Link> & { exact?: boolean }) {
  const pathname = usePathname()
  const href = String(props.href).split("?")[0]
  const active = pathname === href || (!exact && pathname.startsWith(`${href}/`))
  return <Link {...props} aria-current={active ? "page" : undefined} />
}
