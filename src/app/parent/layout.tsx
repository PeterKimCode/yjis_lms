import type { ReactNode } from "react"

import { RoleSidebarLayout } from "@/components/role-sidebar-layout"

export default function ParentLayout({ children }: { children: ReactNode }) {
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
