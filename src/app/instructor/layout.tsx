import type { ReactNode } from "react"

import { RoleSidebarLayout } from "@/components/role-sidebar-layout"

export default function InstructorLayout({ children }: { children: ReactNode }) {
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
