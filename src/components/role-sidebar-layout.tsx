import Link from "next/link"
import type { ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import { requireAuth } from "@/modules/auth/permissions"

type SidebarLink = {
  href: string
  label: string
}

type RoleSidebarLayoutProps = {
  children: ReactNode
  description: string
  links: SidebarLink[]
  title: string
  tone: "instructor" | "student" | "parent"
}

const toneClasses = {
  instructor: {
    active: "hover:bg-emerald-50 hover:text-emerald-700",
    bg: "role-instructor-surface",
    dot: "bg-emerald-500",
  },
  parent: {
    active: "hover:bg-amber-50 hover:text-amber-700",
    bg: "role-parent-surface",
    dot: "bg-amber-500",
  },
  student: {
    active: "hover:bg-blue-50 hover:text-blue-700",
    bg: "role-student-surface",
    dot: "bg-blue-500",
  },
} as const

export async function RoleSidebarLayout({
  children,
  description,
  links,
  title,
  tone,
}: RoleSidebarLayoutProps) {
  const user = await requireAuth()
  const toneClass = toneClasses[tone]

  return (
    <div className={`${toneClass.bg} flex flex-1`}>
      <aside className="hidden w-64 border-r border-slate-200/80 bg-white/90 p-4 shadow-sm shadow-slate-200/60 backdrop-blur md:block">
        <div className="mb-5 space-y-1">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${toneClass.dot}`} />
            <p className="text-sm font-semibold">{title}</p>
          </div>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </div>
        <nav className="grid gap-1">
          {links.map((link) => (
            <Link
              className={`rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors ${toneClass.active}`}
              href={link.href}
              key={link.href}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </aside>
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-slate-200/80 bg-white/85 px-4 py-3 backdrop-blur md:hidden">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">{title}</p>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
            <Badge variant="secondary">{tone.toUpperCase()}</Badge>
          </div>
          <nav className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {links.map((link) => (
              <Link
                className="whitespace-nowrap rounded-md border bg-white px-3 py-1.5 text-xs text-muted-foreground"
                href={link.href}
                key={link.href}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </header>
        {children}
      </section>
    </div>
  )
}
