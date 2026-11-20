import { redirect } from "next/navigation"

export default function LegacyStudentAttendancePage() {
  redirect("/student/school-attendance#class-qr")
}
