import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"

export function AdminAttendanceTabs({ view }: { view: "records" | "qr" }) {
  return (
    <nav aria-label="Attendance views" className="flex flex-wrap gap-2">
      <Link href="/admin/attendance" aria-current={view === "records" ? "page" : undefined}
        className={buttonVariants({ variant: view === "records" ? "default" : "outline" })}>Records</Link>
      <Link href="/admin/attendance/qr" aria-current={view === "qr" ? "page" : undefined}
        className={buttonVariants({ variant: view === "qr" ? "default" : "outline" })}>QR sessions</Link>
    </nav>
  )
}
