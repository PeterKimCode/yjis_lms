import Link from "next/link"
import type { ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import {
  adminCommunicationLinks,
  adminPrimaryLinks,
  adminSetupLinks,
} from "@/modules/admin/components"
import { requireAdmin } from "@/modules/admin/access"

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireAdmin()

  return (
    <div className="role-admin-surface flex flex-1">
      <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-64 overflow-y-auto border-r border-slate-200/80 bg-white/90 p-4 shadow-sm shadow-slate-200/60 backdrop-blur md:block">
        <div className="mb-5">
          <p className="text-sm font-semibold">Admin workspace</p>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </div>
        <nav className="space-y-3">
          <NavGroup links={adminPrimaryLinks} />
          <details className="rounded-md border p-2">
            <summary className="cursor-pointer px-1 text-xs font-medium text-muted-foreground">
              Academic setup
            </summary>
            <div className="mt-2 grid gap-1">
              <NavGroup links={adminSetupLinks} />
            </div>
          </details>
          <NavGroup links={adminCommunicationLinks} />
        </nav>
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

function NavGroup({ links }: { links: readonly (readonly [string, string])[] }) {
  return (
    <div className="grid gap-1">
      {links.map(([href, label]) => (
        <Link
          className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-blue-50 hover:text-blue-700"
          href={href}
          key={href}
        >
          {label}
        </Link>
      ))}
    </div>
  )
}
