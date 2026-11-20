import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"

export function AdminAttendanceTabs({ view }: { view: "records" | "qr" | "today" }) {
  return (
    <nav aria-label="Attendance views" className="flex flex-wrap gap-2">
      <Link href="/admin/attendance/today" aria-current={view === "today" ? "page" : undefined}
        className={buttonVariants({ variant: view === "today" ? "default" : "outline" })}>Today’s school attendance</Link>
      <Link href="/admin/attendance" aria-current={view === "records" ? "page" : undefined}
        className={buttonVariants({ variant: view === "records" ? "default" : "outline" })}>Class records</Link>
      <Link href="/admin/attendance/qr" aria-current={view === "qr" ? "page" : undefined}
        className={buttonVariants({ variant: view === "qr" ? "default" : "outline" })}>Class QR sessions</Link>
    </nav>
  )
}
