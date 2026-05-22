import Link from "next/link"
import Image from "next/image"
import type { ReactNode } from "react"

import { UserRole } from "@prisma/client"

import { RoleSidebarLayout } from "@/components/role-sidebar-layout"
import { Badge } from "@/components/ui/badge"
import {
  adminCommunicationLinks,
  adminPrimaryLinks,
  adminSetupLinks,
} from "@/modules/admin/components"
import { requireAuth } from "@/modules/auth/permissions"
import { getConversationSidebarLinksForUser } from "@/modules/messages/data"

export async function CurrentWorkspaceShell({
  children,
}: {
  children: ReactNode
}) {
  const user = await requireAuth()
  const roles = user.roleAssignments.map((assignment) => assignment.role)
  const messageLinks = await getConversationSidebarLinksForUser(user.id)

  if (roles.some((role) => adminRoles.includes(role))) {
    return (
      <div className="role-admin-surface flex flex-1">
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-64 overflow-y-auto border-r border-slate-800 bg-slate-950 p-4 text-slate-100 shadow-sm shadow-slate-950/40 md:block">
          <div className="mb-4 grid place-items-center">
            <Image
              alt="General Trias College of Cavite"
              className="h-28 w-28 rounded-full object-contain"
              height={112}
              src="/brand/gtcc-logo.png"
              width={112}
            />
          </div>
          <div className="mb-5">
            <p className="text-sm font-semibold">Admin workspace</p>
            <p className="text-xs text-slate-400">{user.email}</p>
          </div>
          <nav className="space-y-3">
            <NavGroup links={adminPrimaryLinks} />
            <details className="rounded-md border border-white/10 p-2" open>
              <summary className="cursor-pointer px-1 text-xs font-medium text-slate-400">
                Academic setup
              </summary>
              <div className="mt-2 grid gap-1">
                <NavGroup links={adminSetupLinks} />
              </div>
            </details>
            <NavGroup links={adminCommunicationLinks} />
            {messageLinks.length ? (
              <div className="ml-3 grid gap-1 border-l border-white/10 pl-2">
                {messageLinks.map((message) => (
                  <Link
                    className="rounded-md px-2 py-1.5 text-xs text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
                    href={message.href}
                    key={message.id}
                  >
                    <span className="block truncate font-medium">
                      {message.label}
                    </span>
                    <span className="block truncate text-[11px] opacity-75">
                      {message.preview}
                    </span>
                  </Link>
                ))}
              </div>
            ) : null}
          </nav>
        </aside>
        <section className="flex min-w-0 flex-1 flex-col">
          <header className="border-b border-slate-200/80 bg-white/85 px-4 py-3 backdrop-blur md:hidden">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Admin dashboard</p>
                <p className="text-xs text-muted-foreground">
                  Manage organizations, academic structure, and communication.
                </p>
              </div>
              <Badge variant="secondary">ADMIN</Badge>
            </div>
          </header>
          {children}
        </section>
      </div>
    )
  }

  if (roles.some((role) => instructorRoles.includes(role))) {
    return (
      <RoleSidebarLayout
        description="Teaching tools, class operations, and communication."
        links={[
          { href: "/instructor", label: "Overview" },
          { href: "/instructor/classes", label: "Classes" },
          { href: "/messages", label: "Messages" },
          { href: "/notifications", label: "Notifications" },
        ]}
        title="Instructor workspace"
        tone="instructor"
      >
        {children}
      </RoleSidebarLayout>
    )
  }

  if (roles.includes(UserRole.STUDENT)) {
    return (
      <RoleSidebarLayout
        description="Classes, coursework, grades, messages, and notifications."
        links={[
          { href: "/student", label: "Overview" },
          { href: "/student/classes", label: "Classes" },
          { href: "/messages", label: "Messages" },
          { href: "/notifications", label: "Notifications" },
        ]}
        title="Student workspace"
        tone="student"
      >
        {children}
      </RoleSidebarLayout>
    )
  }

  if (roles.includes(UserRole.PARENT)) {
    return (
      <RoleSidebarLayout
        description="Linked students, class records, messages, and notifications."
        links={[
          { href: "/parent", label: "Overview" },
          { href: "/parent/students", label: "Linked students" },
          { href: "/messages", label: "Messages" },
          { href: "/notifications", label: "Notifications" },
        ]}
        title="Parent workspace"
        tone="parent"
      >
        {children}
      </RoleSidebarLayout>
    )
  }

  return <>{children}</>
}

const adminRoles: readonly UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ORG_ADMIN,
  UserRole.SCHOOL_ADMIN,
  UserRole.ACADEMIC_STAFF,
]

const instructorRoles: readonly UserRole[] = [
  UserRole.INSTRUCTOR,
  UserRole.HOMEROOM_TEACHER,
]

function NavGroup({ links }: { links: readonly (readonly [string, string])[] }) {
  return (
    <div className="grid gap-1">
      {links.map(([href, label]) => (
        <Link
          className="rounded-md px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
          href={href}
          key={href}
        >
          {label}
        </Link>
      ))}
    </div>
  )
}
