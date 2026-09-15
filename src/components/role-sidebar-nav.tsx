"use client"

import Link from "next/link"
import { useRef, useState } from "react"
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
  PanelLeftClose,
  PanelLeftOpen,
  School,
  type LucideIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { LogoutButton } from "@/modules/auth/logout-button"

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
    active: "bg-zinc-900 text-white",
    hover: "hover:bg-slate-100 hover:text-zinc-900",
    dot: "bg-emerald-500",
  },
  parent: {
    active: "bg-zinc-900 text-white",
    hover: "hover:bg-slate-100 hover:text-zinc-900",
    dot: "bg-amber-500",
  },
  student: {
    active: "bg-zinc-900 text-white",
    hover: "hover:bg-slate-100 hover:text-zinc-900",
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
  const menuButton = useRef<HTMLButtonElement>(null)
  const toneClass = toneClasses[tone]
  const isClassRoute =
    pathname.includes("/classes/") || pathname.endsWith("/classes")

  return (
    <>
      <div aria-hidden="true" className={`hidden shrink-0 md:block ${collapsed ? "w-20" : "w-64"}`} />
      <aside
        className={`fixed bottom-0 left-0 top-16 z-30 hidden flex-col overflow-y-auto border-r border-slate-200 bg-white p-3 text-zinc-800 transition-[width] md:flex ${
          collapsed ? "w-20" : "w-64"
        }`}
      >
        <div className={`mb-7 flex items-center gap-2 py-3 ${collapsed ? "flex-col" : ""}`}>
          <Link aria-label="Go to overview" className="flex min-w-0 flex-1 items-center gap-3" href={`/${tone}`}>
            <Image alt="Organization logo" src={logoUrl} width={40} height={40} className="size-10 shrink-0 object-contain" unoptimized={logoUrl.startsWith("/api/")} />
            {!collapsed ? <span className="min-w-0"><span className="block text-sm font-semibold">{title}</span><span className="block truncate text-xs text-muted-foreground">{userEmail}</span></span> : null}
          </Link>
          <button aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="grid size-8 shrink-0 place-items-center rounded-md text-slate-500 hover:bg-slate-100" type="button" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </button>
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
                      : `text-slate-600 ${toneClass.hover}`
                  }`}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  title={collapsed ? link.label : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className={collapsed ? "sr-only" : ""}>{link.label}</span>
                </Link>
                {!collapsed && link.label === "Classes" && classLinks.length ? (
                  <div className="ml-3 mt-1 grid gap-1 border-l border-slate-200 pl-2">
                    {classLinks.map((classLink) => {
                      const classActive =
                        pathname === classLink.href ||
                        pathname.startsWith(`${classLink.href}/`)

                      return (
                        <Link
                          className={`flex gap-2 rounded-md px-2 py-1.5 text-xs transition-colors ${
                            classActive
                              ? toneClass.active
                              : "text-slate-500 hover:bg-slate-100 hover:text-zinc-900"
                          }`}
                          href={classLink.href}
                          aria-current={classActive ? "page" : undefined}
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
                  <div className="ml-3 mt-1 grid gap-1 border-l border-slate-200 pl-2">
                    {messageLinks.map((messageLink) => {
                      const messageActive = pathname === messageLink.href

                      return (
                        <Link
                          className={`rounded-md px-2 py-1.5 text-xs transition-colors ${
                            messageActive
                              ? toneClass.active
                              : "text-slate-500 hover:bg-slate-100 hover:text-zinc-900"
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
          <div className="mt-5 border-t border-slate-200 pt-4">
            <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Class sections
            </p>
            <div className="grid gap-1">
              {sectionLinks.map((section) => (
                <Link
                  className="flex items-center gap-2 rounded-md px-3 py-1.5 text-xs text-slate-500 transition-colors hover:bg-slate-100 hover:text-zinc-900"
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
        <SidebarAccountActions collapsed={collapsed} />
        <HelpContact collapsed={collapsed} />
      </aside>
      <header className="border-b border-slate-200/80 bg-white/85 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            ref={menuButton}
            aria-expanded={mobileOpen}
            aria-label="Open sidebar menu"
            className="grid size-11 place-items-center rounded-md border bg-white text-slate-700"
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
      <Dialog open={mobileOpen} onOpenChange={setMobileOpen}>
          <DialogContent showCloseButton={false} aria-describedby={undefined} onCloseAutoFocus={(event) => { event.preventDefault(); menuButton.current?.focus() }} className="top-0 bottom-0 left-0 right-auto flex h-dvh w-72 max-w-[85vw] translate-x-0 translate-y-0 flex-col overflow-y-auto rounded-none border-r border-slate-200 bg-white p-4 text-zinc-800 shadow-xl">
            <DialogTitle className="sr-only">{title} menu</DialogTitle>
            <div className="mb-4 flex items-center justify-between">
              <Link
                aria-label="Go to overview"
                className="flex items-center gap-3"
                href={`/${tone}`}
                onClick={() => setMobileOpen(false)}
              >
                <Image
                  alt="Learning Management System"
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
                className="rounded-md border border-slate-200 px-2 py-1 text-xs"
                type="button"
                onClick={() => setMobileOpen(false)}
              >
                Close
              </button>
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
                          : "text-slate-600 hover:bg-slate-100 hover:text-zinc-900"
                      }`}
                      href={link.href}
                      aria-current={active ? "page" : undefined}
                      onClick={() => setMobileOpen(false)}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {link.label}
                    </Link>
                    {link.label === "Classes" && classLinks.length ? (
                      <div className="ml-3 mt-1 grid gap-1 border-l border-slate-200 pl-2">
                        {classLinks.map((classLink) => {
                          const classActive =
                            pathname === classLink.href ||
                            pathname.startsWith(`${classLink.href}/`)

                          return (
                            <Link
                              className={`flex gap-2 rounded-md px-2 py-1.5 text-xs transition-colors ${
                                classActive
                                  ? toneClass.active
                                  : "text-slate-500 hover:bg-slate-100 hover:text-zinc-900"
                              }`}
                              href={classLink.href}
                              aria-current={classActive ? "page" : undefined}
                              key={classLink.id}
                              onClick={() => setMobileOpen(false)}
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
                  </div>
                )
              })}
            </nav>
            {isClassRoute && sectionLinks.length ? (
              <div className="mt-5 border-t border-slate-200 pt-4">
                <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Class sections
                </p>
                <div className="grid gap-1">
                  {sectionLinks.map((section) => (
                    <Link
                      className="flex items-center gap-2 rounded-md px-3 py-1.5 text-xs text-slate-500 transition-colors hover:bg-slate-100 hover:text-zinc-900"
                      href={section.href}
                      key={section.href}
                      onClick={() => setMobileOpen(false)}
                    >
                      {sectionIcon(section.label)}
                      {section.label}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
            <SidebarAccountActions />
            <HelpContact />
          </DialogContent>
      </Dialog>
    </>
  )
}

function SidebarAccountActions({ collapsed = false }: { collapsed?: boolean }) {
  if (collapsed) return null

  return (
    <div className="mt-auto border-t border-slate-200 pt-4">
      <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Account
      </p>
      <LogoutButton
        className="w-full justify-center border-slate-200 bg-slate-50 text-zinc-800 hover:bg-slate-200 hover:text-zinc-900"
        size="sm"
      />
    </div>
  )
}

function HelpContact({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <details className={collapsed ? "mt-auto pt-6" : "pt-4"}>
      <summary
        className={`flex cursor-pointer list-none items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-100 hover:text-zinc-900 ${
          collapsed ? "justify-center px-0" : ""
        }`}
        title={collapsed ? "Help & Contact" : undefined}
      >
        <LifeBuoy className="h-4 w-4 shrink-0" />
        {collapsed ? <span className="sr-only">Help & Contact</span> : "Help & Contact"}
      </summary>
      {!collapsed ? (
        <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          <p className="font-semibold text-zinc-900">ADDRESS</p>
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
