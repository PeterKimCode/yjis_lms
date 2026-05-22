"use client"

import Link from "next/link"
import { useState } from "react"
import { usePathname } from "next/navigation"

import { Badge } from "@/components/ui/badge"

type SidebarLink = {
  href: string
  label: string
}

type ClassLink = {
  href: string
  id: string
  label: string
  subLabel?: string
}

type SectionLink = {
  href: string
  label: string
}

type MessageLink = {
  href: string
  id: string
  label: string
  preview: string
  unreadCount: number
}

type RoleSidebarNavProps = {
  classLinks: ClassLink[]
  description: string
  links: SidebarLink[]
  messageLinks: MessageLink[]
  sectionLinks: SectionLink[]
  title: string
  tone: "instructor" | "student" | "parent"
  userEmail: string | null
}

const toneClasses = {
  instructor: {
    active: "bg-emerald-50 text-emerald-700",
    hover: "hover:bg-emerald-50 hover:text-emerald-700",
    dot: "bg-emerald-500",
  },
  parent: {
    active: "bg-amber-50 text-amber-700",
    hover: "hover:bg-amber-50 hover:text-amber-700",
    dot: "bg-amber-500",
  },
  student: {
    active: "bg-blue-50 text-blue-700",
    hover: "hover:bg-blue-50 hover:text-blue-700",
    dot: "bg-blue-500",
  },
} as const

export function RoleSidebarNav({
  classLinks,
  description,
  links,
  messageLinks,
  sectionLinks,
  title,
  tone,
  userEmail,
}: RoleSidebarNavProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const toneClass = toneClasses[tone]
  const isClassRoute =
    pathname.includes("/classes/") || pathname.endsWith("/classes")

  return (
    <>
      <aside
        className={`sticky top-16 hidden h-[calc(100vh-4rem)] shrink-0 overflow-y-auto border-r border-slate-200/80 bg-white/90 p-3 shadow-sm shadow-slate-200/60 backdrop-blur transition-[width] md:block ${
          collapsed ? "w-16" : "w-64"
        }`}
      >
        <div className="mb-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${toneClass.dot}`} />
              {!collapsed ? (
                <p className="truncate text-sm font-semibold">{title}</p>
              ) : null}
            </div>
            <button
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-md border bg-white text-xs text-muted-foreground transition-colors hover:bg-slate-50 hover:text-foreground"
              type="button"
              onClick={() => setCollapsed((value) => !value)}
            >
              {collapsed ? "›" : "‹"}
            </button>
          </div>
          {!collapsed ? (
            <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
          ) : null}
        </div>
        <nav className="grid gap-1">
          {links.map((link) => {
            const active =
              pathname === link.href ||
              (link.href !== `/${tone}` && pathname.startsWith(`${link.href}/`))

            return (
              <div key={link.href}>
                <Link
                  className={`block rounded-md px-3 py-2 text-sm transition-colors ${
                    active
                      ? toneClass.active
                      : `text-muted-foreground ${toneClass.hover}`
                  }`}
                  href={link.href}
                >
                  <span className={collapsed ? "sr-only" : ""}>{link.label}</span>
                  {collapsed ? link.label.slice(0, 1) : null}
                </Link>
                {!collapsed && link.label === "Classes" && classLinks.length ? (
                  <div className="ml-3 mt-1 grid gap-1 border-l border-slate-200 pl-2">
                    {classLinks.map((classLink) => {
                      const classActive =
                        pathname === classLink.href ||
                        pathname.startsWith(`${classLink.href}/`)

                      return (
                        <Link
                          className={`rounded-md px-2 py-1.5 text-xs transition-colors ${
                            classActive
                              ? toneClass.active
                              : "text-muted-foreground hover:bg-slate-50 hover:text-foreground"
                          }`}
                          href={classLink.href}
                          key={classLink.id}
                        >
                          <span className="block truncate font-medium">
                            {classLink.label}
                          </span>
                          {classLink.subLabel ? (
                            <span className="block truncate text-[11px] opacity-75">
                              {classLink.subLabel}
                            </span>
                          ) : null}
                        </Link>
                      )
                    })}
                  </div>
                ) : null}
                {!collapsed &&
                link.label === "Messages" &&
                pathname.startsWith("/messages") &&
                messageLinks.length ? (
                  <div className="ml-3 mt-1 grid gap-1 border-l border-slate-200 pl-2">
                    {messageLinks.map((messageLink) => {
                      const messageActive = pathname === messageLink.href

                      return (
                        <Link
                          className={`rounded-md px-2 py-1.5 text-xs transition-colors ${
                            messageActive
                              ? toneClass.active
                              : "text-muted-foreground hover:bg-slate-50 hover:text-foreground"
                          }`}
                          href={messageLink.href}
                          key={messageLink.id}
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className="min-w-0 truncate font-medium">
                              {messageLink.label}
                            </span>
                            {messageLink.unreadCount ? (
                              <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">
                                {messageLink.unreadCount}
                              </span>
                            ) : null}
                          </span>
                          <span className="block truncate text-[11px] opacity-75">
                            {messageLink.preview}
                          </span>
                        </Link>
                      )
                    })}
                  </div>
                ) : null}
              </div>
            )
          })}
        </nav>
        {!collapsed && isClassRoute && sectionLinks.length ? (
          <div className="mt-5 border-t border-slate-200 pt-4">
            <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Class sections
            </p>
            <div className="grid gap-1">
              {sectionLinks.map((section) => (
                <Link
                  className="rounded-md px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-slate-50 hover:text-foreground"
                  href={section.href}
                  key={section.href}
                >
                  {section.label}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </aside>
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
    </>
  )
}
