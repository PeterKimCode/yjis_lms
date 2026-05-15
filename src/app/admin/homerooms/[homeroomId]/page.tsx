import Link from "next/link"
import { notFound } from "next/navigation"

import {
  HomeroomForm,
  HomeroomStudentManagement,
} from "@/modules/admin/academic-management"
import { AdminPageHeader, FormCard } from "@/modules/admin/components"
import { getHomeroomDetailForAdmin } from "@/modules/admin/data"

export default async function HomeroomDetailPage({
  params,
}: {
  params: Promise<{ homeroomId: string }>
}) {
  const { homeroomId } = await params
  const data = await getHomeroomDetailForAdmin(homeroomId)

  if (!data) {
    notFound()
  }

  const { homeroom } = data
  const teacher = homeroom.teacher
    ? `${homeroom.teacher.name}${
        homeroom.teacher.email ? ` (${homeroom.teacher.email})` : ""
      }`
    : "-"

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          href="/admin/homerooms"
        >
          Back to homerooms
        </Link>
        <AdminPageHeader
          title={homeroom.name}
          description="Manage homeroom details and student placement."
        />
      </div>

      <FormCard title="Homeroom summary">
        <dl className="grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
          <SummaryItem label="Grade level" value={homeroom.gradeLevel?.name ?? "-"} />
          <SummaryItem
            label="Campus"
            value={homeroom.campus?.name ?? "Organization-wide"}
          />
          <SummaryItem label="Organization" value={homeroom.organization.name} />
          <SummaryItem label="Teacher" value={teacher} />
          <SummaryItem
            label="Students"
            value={`${homeroom._count.studentProfiles} ${
              homeroom._count.studentProfiles === 1 ? "student" : "students"
            }`}
          />
        </dl>
      </FormCard>

      <HomeroomForm data={data} homeroom={homeroom} />
      <HomeroomStudentManagement data={data} homeroom={homeroom} />
    </div>
  )
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium uppercase text-muted-foreground">
        {label}
      </dt>
      <dd className="truncate font-medium" title={value}>
        {value}
      </dd>
    </div>
  )
}
