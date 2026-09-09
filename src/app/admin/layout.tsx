import type { ReactNode } from "react"
import { AdminWorkspace } from "@/components/admin-workspace"

export const metadata = { title: { default: "Administration", template: "%s | LMS" }, robots: { index: false, follow: false } }

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminWorkspace>{children}</AdminWorkspace>
}
