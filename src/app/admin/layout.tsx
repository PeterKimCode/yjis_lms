import Link from "next/link"
import type { ReactNode } from "react"

import { Badge } from "@/components/ui/badge"
import { adminLinks } from "@/modules/admin/components"
import { requireAdmin } from "@/modules/admin/access"

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireAdmin()

  return (
    <div className="flex flex-1 bg-muted/40">
      <aside className="hidden w-64 border-r bg-background p-4 md:block">
        <div className="mb-5">
          <p className="text-sm font-semibold">Academic Setup</p>
          <p className="text-xs text-muted-foreground">{user.email}</p>
        </div>
        <nav className="grid gap-1">
          {adminLinks.map(([href, label]) => (
            <Link
              className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              href={href}
              key={href}
            >
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="border-b bg-background px-4 py-3">
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
