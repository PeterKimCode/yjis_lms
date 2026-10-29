"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { Menu, Home, BookOpen, GraduationCap, Users, FileText, Layers, MessageSquare, Bell, Settings, PanelLeftClose, PanelLeftOpen, Building2, MapPin, Network, CalendarDays, CalendarRange, ListOrdered, School, ShieldCheck, ScrollText, Megaphone } from "lucide-react"
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { adminPrimaryLinks, adminSetupLinks } from "@/modules/admin/components"
import { SidebarFooter } from "@/components/sidebar-footer"
import { useSidebarPreference } from "@/components/use-sidebar-preference"

type MessageLink = { id: string; href: string; label: string; preview: string; unreadCount: number }
const icons = { Overview: Home, Courses: BookOpen, "Class Sections": GraduationCap, Users, Files: FileText, Boards: Layers, Messages: MessageSquare, Notifications: Bell, "Audit Logs": ScrollText, Organizations: Building2, Campuses: MapPin, Departments: Network, "Academic Years": CalendarDays, Terms: CalendarRange, "Grade Levels": ListOrdered, Homerooms: School, Policies: ShieldCheck, "Login notices": Megaphone }

export function AdminSidebar({ logoUrl, email, schoolOnly, messages = [], canManageAdmissions = false, pendingRequests = 0 }: {
  logoUrl: string; email: string | null; schoolOnly: boolean; messages?: MessageLink[]; canManageAdmissions?: boolean; pendingRequests?: number
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [collapsed, toggleCollapsed] = useSidebarPreference()
  const primary = schoolOnly ? adminPrimaryLinks.filter(([, label]) => ["Courses", "Class Sections", "Users", "Files"].includes(label)) : adminPrimaryLinks
  const admissionLinks = canManageAdmissions ? [["/admin/enrollment-requests", `Enrollment requests${pendingRequests ? ` (${pendingRequests})` : ""}`], ["/admin/login-notices", "Login notices"]] as const : []
  function group(links: readonly (readonly [string, string])[], compact = false) {
    return <div className="grid gap-1">{links.map(([href, label]) => {
      const active = pathname === href || (href !== "/admin" && pathname.startsWith(`${href}/`))
      const Icon = icons[label as keyof typeof icons] ?? Settings
      return <Link key={href} href={href} title={compact ? label : undefined} aria-current={active ? "page" : undefined} onClick={() => setOpen(false)} className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${compact ? "justify-center" : ""} ${active ? "bg-zinc-900 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-zinc-900"}`}><Icon className="size-4 shrink-0" /><span className={compact ? "sr-only" : ""}>{label}</span></Link>
    })}</div>
  }
  function contents(compact = false, desktop = false) {
    return <>
      <div className={`sidebar-heading flex shrink-0 items-center gap-2 p-4 ${compact ? "flex-col" : ""}`}>
      <Link href={schoolOnly ? "/admin/users" : "/admin"} aria-label="Admin home" className="flex min-w-0 flex-1 items-center gap-3" onClick={() => setOpen(false)}>
        <Image alt="Organization logo" src={logoUrl} width={40} height={40} className="size-10 shrink-0 object-contain" unoptimized={logoUrl.startsWith("/api/")} />
        {!compact ? <span className="min-w-0"><span className="block text-sm font-semibold">Admin workspace</span><span className="block truncate text-xs text-slate-500">{email}</span></span> : null}
      </Link>
      {desktop ? <button type="button" aria-label={compact ? "Expand sidebar" : "Collapse sidebar"} title={compact ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!compact} className="grid size-8 shrink-0 place-items-center rounded-md text-slate-500 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600" onClick={toggleCollapsed}>{compact ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}</button> : null}
      </div>
      <nav aria-label="Admin navigation" className="sidebar-scroll min-h-0 min-w-0 flex-1 space-y-3 overflow-x-hidden overflow-y-auto overscroll-contain p-3">
        {group(primary, compact)}
        {!schoolOnly ? compact ? <div className="border-y border-slate-200 py-2" role="group" aria-label="Academic setup">{group(adminSetupLinks, true)}</div> : <details open className="rounded-md border border-slate-200 p-2"><summary className="cursor-pointer px-2 py-2 text-sm">Academic setup</summary>{group(adminSetupLinks)}</details> : null}
        {group(admissionLinks, compact)}
        {!compact && pathname.startsWith("/messages") && messages.length ? <div className="ml-3 grid gap-1 border-l border-slate-200 pl-2">{messages.map((message) => <Link key={message.id} href={message.href} onClick={() => setOpen(false)} aria-current={pathname === message.href ? "page" : undefined} className="rounded-md p-2 text-xs hover:bg-slate-100"><span className="block truncate font-medium">{message.label}{message.unreadCount ? ` (${message.unreadCount})` : ""}</span><span className="block truncate text-slate-500">{message.preview}</span></Link>)}</div> : null}
      </nav>
      <SidebarFooter compact={compact} onNavigate={() => setOpen(false)} />
    </>
  }
  return <>
    <div aria-hidden="true" className={`hidden shrink-0 md:block ${collapsed ? "w-20" : "w-64"}`} />
    <aside className={`fixed bottom-0 left-0 top-16 z-30 hidden flex-col overflow-hidden border-r border-slate-200 bg-[var(--sidebar)] p-0 text-zinc-800 transition-[width] md:flex ${collapsed ? "w-20" : "w-64"}`}>{contents(collapsed, true)}</aside>
    <div className="border-b bg-white px-4 py-2 md:hidden">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button variant="outline" aria-label="Open admin menu"><Menu />Menu</Button></DialogTrigger>
        <DialogContent aria-describedby={undefined} className="fixed top-0 bottom-0 left-0 right-auto flex h-dvh max-h-dvh w-[min(20rem,90vw)] translate-x-0 translate-y-0 flex-col overflow-hidden rounded-none bg-[var(--sidebar)] p-0 text-zinc-800 sm:max-w-sm">
          <DialogTitle className="sr-only">Admin menu</DialogTitle>{contents()}
        </DialogContent>
      </Dialog>
    </div>
  </>
}
