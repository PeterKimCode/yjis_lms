import type { ReactNode } from "react"
import { requireAuth } from "@/modules/auth/permissions"
import { adminRoles } from "@/modules/admin/scope-rules"
import { AdminWorkspace } from "./admin-workspace"
import { RoleSidebarLayout } from "./role-sidebar-layout"

export async function CurrentWorkspaceShell({ children }: { children: ReactNode }) {
  const user = await requireAuth()
  const roles = user.roleAssignments.map((assignment) => assignment.role)
  if (roles.some((role) => adminRoles.includes(role))) return <AdminWorkspace communication>{children}</AdminWorkspace>
  const tone = roles.some((role) => role === "INSTRUCTOR" || role === "HOMEROOM_TEACHER") ? "instructor" : roles.includes("STUDENT") ? "student" : roles.includes("PARENT") ? "parent" : null
  if (!tone) return <>{children}</>
  const parent = tone === "parent"
  return <RoleSidebarLayout tone={tone} title={`${tone[0].toUpperCase()}${tone.slice(1)} workspace`} description={parent ? "Linked students, class records, messages, and notifications." : "Classes, coursework, messages, and notifications."} links={[
    { href: `/${tone}`, label: "Overview" },
    { href: parent ? "/parent/students" : `/${tone}/classes`, label: parent ? "Linked students" : "Classes" },
    { href: "/messages", label: "Messages" },
    { href: "/notifications", label: "Notifications" },
  ]}>{children}</RoleSidebarLayout>
}
