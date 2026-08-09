import Link from "next/link"
import Image from "next/image"
import type { ReactNode } from "react"
import {
  Bell,
  BookOpen,
  Building2,
  CalendarDays,
  FileText,
  GraduationCap,
  Home,
  Layers,
  MessageSquare,
  School,
  Settings,
  Users,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  adminCommunicationLinks,
  adminPrimaryLinks,
  adminSetupLinks,
} from "@/modules/admin/components"
import { requireAdmin } from "@/modules/admin/access"
import { getOrganizationLogoUrl } from "@/modules/branding/organization-logo"
import { UserRole } from "@prisma/client"
import { LogoutButton } from "@/modules/auth/logout-button"

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireAdmin()
  const logoUrl = await getOrganizationLogoUrl(user.organizationId)
  const isSchoolAdminOnly =
    user.roleAssignments.some(
      (assignment) => assignment.role === UserRole.SCHOOL_ADMIN
    ) &&
    !user.roleAssignments.some(
      (assignment) => assignment.role === UserRole.SUPER_ADMIN
    )
  const visiblePrimaryLinks = isSchoolAdminOnly
    ? adminPrimaryLinks.filter(([, label]) =>
        ["Courses", "Class Sections", "Users", "Files"].includes(label)
      )
    : adminPrimaryLinks

  return (
    <div className="role-admin-surface flex flex-1">
      <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-64 flex-col overflow-y-auto border-r border-slate-800 bg-slate-950 p-4 text-slate-100 shadow-sm shadow-slate-950/40 md:flex">
        <div className="mb-4 grid place-items-center">
          <Link aria-label="Go to admin overview" href="/admin">
            <Image
              alt="Learning Management System"
              className="h-28 w-28 rounded-full object-contain transition-transform hover:scale-105"
              height={112}
              loading="eager"
              src={logoUrl}
              width={112}
              unoptimized={logoUrl.startsWith("/api/")}
            />
          </Link>
        </div>
        <div className="mb-5">
          <p className="text-sm font-semibold">Admin workspace</p>
          <p className="text-xs text-slate-400">{user.email}</p>
        </div>
        <nav className="space-y-3">
          <NavGroup links={visiblePrimaryLinks} />
          {!isSchoolAdminOnly ? (
            <>
              <details className="rounded-md border border-white/10 p-2" open>
                <summary className="cursor-pointer px-1 text-xs font-medium text-slate-400">
                  Academic setup
                </summary>
                <div className="mt-2 grid gap-1">
                  <NavGroup links={adminSetupLinks} />
                </div>
              </details>
              <NavGroup links={adminCommunicationLinks} />
            </>
          ) : null}
        </nav>
        <div className="mt-auto space-y-3 pt-6">
          <LogoutButton
            className="w-full justify-center border-white/10 bg-white/10 text-slate-100 hover:bg-white/20 hover:text-white"
            size="sm"
          />
          <HelpContact />
        </div>
      </aside>
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="border-b border-slate-200/80 bg-white/85 px-4 py-3 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Admin dashboard</p>
              <p className="text-xs text-muted-foreground">
                Manage organizations, academic structure, and class setup.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {user.roleAssignments.map((assignment) => (
                <Badge key={`${assignment.role}-${assignment.campusId}`}>
                  {assignment.role}
                </Badge>
              ))}
            </div>
          </div>
        </header>
        <div className="p-4 md:p-6">{children}</div>
      </section>
    </div>
  )
}

function HelpContact() {
  return (
    <details>
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-white/10 hover:text-white">
        <Settings className="h-4 w-4 shrink-0" />
        Help & Contact
      </summary>
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
    </details>
  )
}

function NavGroup({ links }: { links: readonly (readonly [string, string])[] }) {
  return (
    <div className="grid gap-1">
      {links.map(([href, label]) => (
        <Link
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
          href={href}
          key={href}
        >
          <AdminNavIcon label={label} />
          {label}
        </Link>
      ))}
    </div>
  )
}

function AdminNavIcon({ label }: { label: string }) {
  const normalized = label.toLowerCase()
  const className = "h-4 w-4 shrink-0"

  if (normalized.includes("overview")) return <Home className={className} />
  if (normalized.includes("class")) return <GraduationCap className={className} />
  if (normalized.includes("course")) return <BookOpen className={className} />
  if (normalized.includes("user")) return <Users className={className} />
  if (normalized.includes("board")) return <Layers className={className} />
  if (normalized.includes("file")) return <FileText className={className} />
  if (normalized.includes("organization")) return <Building2 className={className} />
  if (normalized.includes("campus")) return <School className={className} />
  if (normalized.includes("year") || normalized.includes("term")) {
    return <CalendarDays className={className} />
  }
  if (normalized.includes("grade") || normalized.includes("homeroom")) {
    return <GraduationCap className={className} />
  }
  if (normalized.includes("department") || normalized.includes("polic")) {
    return <Settings className={className} />
  }
  if (normalized.includes("message")) return <MessageSquare className={className} />
  if (normalized.includes("notification")) return <Bell className={className} />

  return <Layers className={className} />
}
