"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState } from "react"
import { Menu, Home, BookOpen, GraduationCap, Users, FileText, Layers, MessageSquare, Bell, Settings, LifeBuoy } from "lucide-react"
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { adminPrimaryLinks, adminSetupLinks, adminCommunicationLinks } from "@/modules/admin/components"
import { LogoutButton } from "@/modules/auth/logout-button"

type MessageLink = { id: string; href: string; label: string; preview: string; unreadCount: number }
const icons = { Overview: Home, Courses: BookOpen, "Class Sections": GraduationCap, Users, Files: FileText, Boards: Layers, Messages: MessageSquare, Notifications: Bell }

export function AdminSidebar({ logoUrl, email, schoolOnly, messages = [] }: {
  logoUrl: string; email: string | null; schoolOnly: boolean; messages?: MessageLink[]
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const primary = schoolOnly ? adminPrimaryLinks.filter(([, label]) => ["Courses", "Class Sections", "Users", "Files"].includes(label)) : adminPrimaryLinks
  function group(links: readonly (readonly [string, string])[]) {
    return <div className="grid gap-1">{links.map(([href, label]) => {
      const active = pathname === href || (href !== "/admin" && pathname.startsWith(`${href}/`))
      const Icon = icons[label as keyof typeof icons] ?? Settings
      return <Link key={href} href={href} aria-current={active ? "page" : undefined} onClick={() => setOpen(false)} className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm ${active ? "bg-white text-slate-950" : "text-slate-300 hover:bg-white/10 hover:text-white"}`}><Icon className="size-4 shrink-0" />{label}</Link>
    })}</div>
  }
  function contents() {
    return <>
      <Link href={schoolOnly ? "/admin/users" : "/admin"} aria-label="Admin home" className="mb-4 flex justify-center" onClick={() => setOpen(false)}><Image alt="Organization logo" src={logoUrl} width={112} height={112} className="size-28 rounded-full object-contain" unoptimized={logoUrl.startsWith("/api/")} /></Link>
      <p className="text-sm font-semibold">Admin workspace</p><p className="mb-5 truncate text-xs text-slate-300">{email}</p>
      <nav aria-label="Admin navigation" className="space-y-3">
        {group(primary)}
        {!schoolOnly ? <details open className="rounded-md border border-white/10 p-2"><summary className="cursor-pointer px-2 py-2 text-sm">Academic setup</summary>{group(adminSetupLinks)}</details> : null}
        {group(adminCommunicationLinks)}
        {pathname.startsWith("/messages") && messages.length ? <div className="ml-3 grid gap-1 border-l border-white/20 pl-2">{messages.map((message) => <Link key={message.id} href={message.href} onClick={() => setOpen(false)} aria-current={pathname === message.href ? "page" : undefined} className="rounded-md p-2 text-xs hover:bg-white/10"><span className="block truncate font-medium">{message.label}{message.unreadCount ? ` (${message.unreadCount})` : ""}</span><span className="block truncate text-slate-300">{message.preview}</span></Link>)}</div> : null}
      </nav>
      <div className="mt-auto space-y-3 pt-6">
        <LogoutButton size="sm" className="w-full border-white/10 bg-white/10 text-slate-100 hover:bg-white/20" />
        <details><summary className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm"><LifeBuoy className="size-4" />Help & Contact</summary><div className="space-y-2 p-3 text-xs text-slate-300"><p>B1 L2 ABCD Sunny Brooke 2 Brgy. San Francisco General Tria City Cavite</p><p>(046) 402-1779 / 0917-155-1779 / 0917-175-1779</p><a className="underline" href="mailto:gtcc2006@gmail.com">gtcc2006@gmail.com</a></div></details>
      </div>
    </>
  }
  return <>
    <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-64 shrink-0 flex-col overflow-y-auto border-r border-slate-800 bg-slate-950 p-4 text-slate-100 md:flex">{contents()}</aside>
    <div className="border-b bg-white px-4 py-2 md:hidden">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button variant="outline" aria-label="Open admin menu"><Menu />Menu</Button></DialogTrigger>
        <DialogContent aria-describedby={undefined} className="fixed top-0 bottom-0 left-0 right-auto flex h-dvh max-h-dvh w-[min(20rem,90vw)] translate-x-0 translate-y-0 flex-col overflow-y-auto rounded-none bg-slate-950 p-4 text-slate-100 sm:max-w-sm">
          <DialogTitle className="sr-only">Admin menu</DialogTitle>{contents()}
        </DialogContent>
      </Dialog>
    </div>
  </>
}
