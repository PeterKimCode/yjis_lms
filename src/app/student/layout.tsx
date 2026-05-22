import type { ReactNode } from "react"

import { RoleSidebarLayout } from "@/components/role-sidebar-layout"

export default function StudentLayout({ children }: { children: ReactNode }) {
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
