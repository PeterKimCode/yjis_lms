import type { ReactNode } from "react"
import { requireAdmin, isSuperAdmin } from "@/modules/admin/access"
import { getOrganizationLogoUrl } from "@/modules/branding/organization-logo"
import { getConversationSidebarLinksForUser } from "@/modules/messages/data"
import { AdminSidebar } from "./admin-sidebar"

export async function AdminWorkspace({ children, communication = false }: { children: ReactNode; communication?: boolean }) {
  const user = await requireAdmin()
  const [logoUrl, messages] = await Promise.all([
    getOrganizationLogoUrl(user.organizationId),
    communication ? getConversationSidebarLinksForUser(user.id) : Promise.resolve([]),
  ])
  return <div className="role-admin-surface flex min-w-0 flex-1 flex-col md:flex-row">
    <AdminSidebar logoUrl={logoUrl} email={user.email} schoolOnly={!isSuperAdmin(user) && user.roleAssignments.some((assignment) => assignment.role === "SCHOOL_ADMIN")} messages={messages} />
    <section className={`flex min-w-0 flex-1 flex-col ${communication ? "" : "p-4 md:p-6"}`}>{children}</section>
  </div>
}
