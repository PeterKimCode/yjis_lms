import type { ReactNode } from "react"
import { requireAdmin, isSuperAdmin } from "@/modules/admin/access"
import { getOrganizationLogoUrl } from "@/modules/branding/organization-logo"
import { getConversationSidebarLinksForUser } from "@/modules/messages/data"
import { AdminSidebar } from "./admin-sidebar"
import { getPrismaClient } from "@/lib/prisma"
import { reviewScope } from "@/modules/catalog/rules"

export async function AdminWorkspace({ children, communication = false }: { children: ReactNode; communication?: boolean }) {
  const user = await requireAdmin()
  const canManageAdmissions = user.roleAssignments.some(a => a.role === "SUPER_ADMIN" || a.role === "SCHOOL_ADMIN")
  const pendingRequests = canManageAdmissions ? await getPrismaClient().enrollmentRequest.count({ where: { status: "PENDING", classSection: reviewScope(user.roleAssignments) } }) : 0
  const [logoUrl, messages] = await Promise.all([
    getOrganizationLogoUrl(user.organizationId),
    communication ? getConversationSidebarLinksForUser(user.id) : Promise.resolve([]),
  ])
  return <div className="role-admin-surface flex min-w-0 flex-1 flex-col md:flex-row">
    <AdminSidebar canManageAdmissions={canManageAdmissions} pendingRequests={pendingRequests} logoUrl={logoUrl} email={user.email} schoolOnly={!isSuperAdmin(user) && user.roleAssignments.some((assignment) => assignment.role === "SCHOOL_ADMIN")} messages={messages} />
    <section className={`flex min-w-0 flex-1 flex-col ${communication ? "" : "px-4 py-8 sm:px-6 lg:px-10 lg:py-10"}`}>{children}</section>
  </div>
}
