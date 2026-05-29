"use client"

import Link from "next/link"
import { useState } from "react"
import Image from "next/image"
import { usePathname } from "next/navigation"
import {
  Bell,
  BookOpen,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  FileText,
  GraduationCap,
  Home,
  Layers,
  LifeBuoy,
  Menu,
  MessageSquare,
  NotebookTabs,
  School,
  type LucideIcon,
} from "lucide-react"

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
  logoUrl: string
  messageLinks: MessageLink[]
  sectionLinks: SectionLink[]
  title: string
  tone: "instructor" | "student" | "parent"
  userEmail: string | null
}

const toneClasses = {
  instructor: {
    active: "bg-white text-slate-950 shadow-sm",
    hover: "hover:bg-white/10 hover:text-white",
    dot: "bg-emerald-500",
  },
  parent: {
    active: "bg-white text-slate-950 shadow-sm",
    hover: "hover:bg-white/10 hover:text-white",
    dot: "bg-amber-500",
  },
  student: {
    active: "bg-white text-slate-950 shadow-sm",
    hover: "hover:bg-white/10 hover:text-white",
    dot: "bg-blue-500",
  },
} as const

export function RoleSidebarNav({
  classLinks,
  description,
  links,
  logoUrl,
  messageLinks,
  sectionLinks,
  title,
  tone,
  userEmail,
}: RoleSidebarNavProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const toneClass = toneClasses[tone]
  const isClassRoute =
    pathname.includes("/classes/") || pathname.endsWith("/classes")

  return (
    <>
      <aside
        className={`sticky top-16 hidden h-[calc(100vh-4rem)] shrink-0 flex-col overflow-y-auto border-r border-slate-800 bg-slate-950 p-3 text-slate-100 shadow-sm shadow-slate-950/40 transition-[width] md:flex ${
          collapsed ? "w-16" : "w-64"
        }`}
      >
        <div className={`mb-4 grid place-items-center ${collapsed ? "px-0" : "px-3"}`}>
          <Link aria-label="Go to overview" href={`/${tone}`}>
            <Image
              alt="General Trias College of Cavite"
              className={`rounded-full object-contain transition-transform hover:scale-105 ${
                collapsed ? "h-10 w-10" : "h-28 w-28"
              }`}
              height={112}
              loading="eager"
              src={logoUrl}
              width={112}
              unoptimized={logoUrl.startsWith("/api/")}
            />
          </Link>
        </div>
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
              className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-white/10 bg-white/10 text-xs text-slate-300 transition-colors hover:bg-white/20 hover:text-white"
              type="button"
              onClick={() => setCollapsed((value) => !value)}
            >
              {collapsed ? ">" : "<"}
            </button>
          </div>
          {!collapsed ? (
            <p className="truncate text-xs text-slate-400">{userEmail}</p>
          ) : null}
        </div>
        <nav className="grid gap-1">
          {links.map((link) => {
            const active =
              pathname === link.href ||
              (link.href !== `/${tone}` && pathname.startsWith(`${link.href}/`))
            const Icon = getSidebarIcon(link.label)

            return (
              <div key={link.href}>
                <Link
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                    active
                      ? toneClass.active
                      : `text-slate-300 ${toneClass.hover}`
                  }`}
                  href={link.href}
                  title={collapsed ? link.label : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className={collapsed ? "sr-only" : ""}>{link.label}</span>
                </Link>
                {!collapsed && link.label === "Classes" && classLinks.length ? (
                  <div className="ml-3 mt-1 grid gap-1 border-l border-white/10 pl-2">
                    {classLinks.map((classLink) => {
                      const classActive =
                        pathname === classLink.href ||
                        pathname.startsWith(`${classLink.href}/`)

                      return (
                        <Link
                          className={`flex gap-2 rounded-md px-2 py-1.5 text-xs transition-colors ${
                            classActive
                              ? toneClass.active
                              : "text-slate-400 hover:bg-white/10 hover:text-white"
                          }`}
                          href={classLink.href}
                          key={classLink.id}
                        >
                          <School className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span className="min-w-0">
                            <span
                              className="block whitespace-normal break-words font-medium leading-snug"
                              style={{
                                WebkitBoxOrient: "vertical",
                                WebkitLineClamp: 2,
                                display: "-webkit-box",
                                overflow: "hidden",
                              }}
                            >
                              {classLink.label}
                            </span>
                            {classLink.subLabel ? (
                              <span className="block truncate text-[11px] opacity-75">
                                {classLink.subLabel}
                              </span>
                            ) : null}
                          </span>
                        </Link>
                      )
                    })}
                  </div>
                ) : null}
                {!collapsed &&
                link.label === "Messages" &&
                pathname.startsWith("/messages") &&
                messageLinks.length ? (
                  <div className="ml-3 mt-1 grid gap-1 border-l border-white/10 pl-2">
                    {messageLinks.map((messageLink) => {
                      const messageActive = pathname === messageLink.href

                      return (
                        <Link
                          className={`rounded-md px-2 py-1.5 text-xs transition-colors ${
                            messageActive
                              ? toneClass.active
                              : "text-slate-400 hover:bg-white/10 hover:text-white"
                          }`}
                          href={messageLink.href}
                          key={messageLink.id}
                        >
                          <span className="flex items-center justify-between gap-2">
                            <span className="flex min-w-0 items-center gap-1.5 truncate font-medium">
                              <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{messageLink.label}</span>
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
          <div className="mt-5 border-t border-white/10 pt-4">
            <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Class sections
            </p>
            <div className="grid gap-1">
              {sectionLinks.map((section) => (
                <Link
                  className="flex items-center gap-2 rounded-md px-3 py-1.5 text-xs text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
                  href={section.href}
                  key={section.href}
                >
                  {sectionIcon(section.label)}
                  {section.label}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
        <HelpContact collapsed={collapsed} />
      </aside>
      <header className="border-b border-slate-200/80 bg-white/85 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            aria-label="Open sidebar menu"
            className="grid h-9 w-9 place-items-center rounded-md border bg-white text-slate-700"
            type="button"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{title}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          <Badge variant="secondary">{tone.toUpperCase()}</Badge>
        </div>
      </header>
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            aria-label="Close sidebar menu"
            className="absolute inset-0 bg-slate-950/60"
            type="button"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative flex h-full w-72 max-w-[85vw] flex-col overflow-y-auto border-r border-slate-800 bg-slate-950 p-4 text-slate-100 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <Link
                aria-label="Go to overview"
                className="flex items-center gap-3"
                href={`/${tone}`}
                onClick={() => setMobileOpen(false)}
              >
                <Image
                  alt="General Trias College of Cavite"
                  className="h-12 w-12 rounded-full object-contain"
                  height={48}
                  loading="eager"
                  src={logoUrl}
                  width={48}
                  unoptimized={logoUrl.startsWith("/api/")}
                />
                <span className="text-sm font-semibold">{title}</span>
              </Link>
              <button
                className="rounded-md border border-white/10 px-2 py-1 text-xs"
                type="button"
                onClick={() => setMobileOpen(false)}
              >
                Close
              </button>
            </div>
            <nav className="grid gap-1">
              {links.map((link) => {
                const Icon = getSidebarIcon(link.label)
                return (
                  <Link
                    className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-300 hover:bg-white/10 hover:text-white"
                    href={link.href}
                    key={link.href}
                    onClick={() => setMobileOpen(false)}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {link.label}
                  </Link>
                )
              })}
            </nav>
            <HelpContact />
          </aside>
        </div>
      ) : null}
    </>
  )
}

function HelpContact({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <details className="mt-auto pt-6">
      <summary
        className={`flex cursor-pointer list-none items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-white/10 hover:text-white ${
          collapsed ? "justify-center px-0" : ""
        }`}
        title={collapsed ? "Help & Contact" : undefined}
      >
        <LifeBuoy className="h-4 w-4 shrink-0" />
        {collapsed ? <span className="sr-only">Help & Contact</span> : "Help & Contact"}
      </summary>
      {!collapsed ? (
        <div className="mt-2 rounded-lg border border-white/10 bg-white/5 p-3 text-xs text-slate-300">
          <p className="font-semibold text-white">ADDRESS</p>
          <p className="mt-1">
            B1 L2 ABCD Sunny Brooke 2 Brgy. San Francisco General Tria City
            Cavite
          </p>
          <p className="mt-3 font-semibold text-white">PHONE AND EMAIL</p>
          <p className="mt-1">
            (046) 402-1779 / 0917-155-1779 / 0917-175-1779
            <br />
            gtcc2006@gmail.com
          </p>
        </div>
      ) : null}
    </details>
  )
}

function getSidebarIcon(label: string): LucideIcon {
  const normalized = label.toLowerCase()

  if (normalized.includes("overview")) return Home
  if (normalized.includes("class")) return GraduationCap
  if (normalized.includes("message")) return MessageSquare
  if (normalized.includes("notification")) return Bell
  if (normalized.includes("linked")) return School

  return Layers
}

function sectionIcon(label: string) {
  const normalized = label.toLowerCase()
  const className = "h-3.5 w-3.5 shrink-0"

  if (normalized.includes("lesson")) return <BookOpen className={className} />
  if (normalized.includes("session")) return <CalendarDays className={className} />
  if (normalized.includes("attendance")) return <CheckSquare className={className} />
  if (normalized.includes("assignment")) return <ClipboardList className={className} />
  if (normalized.includes("quiz")) return <NotebookTabs className={className} />
  if (normalized.includes("exam")) return <FileText className={className} />
  if (normalized.includes("grade")) return <GraduationCap className={className} />

  return <Layers className={className} />
}
