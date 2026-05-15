import Link from "next/link"
import { notFound } from "next/navigation"

import {
  ClassSectionForm,
  EnrollmentManagement,
  InstructorManagement,
} from "@/modules/admin/academic-management"
import { AdminPageHeader, FormCard } from "@/modules/admin/components"
import { getClassSectionDetailForAdmin } from "@/modules/admin/data"

export default async function ClassSectionDetailPage({
  params,
}: {
  params: Promise<{ classSectionId: string }>
}) {
  const { classSectionId } = await params
  const data = await getClassSectionDetailForAdmin(classSectionId)

  if (!data) {
    notFound()
  }

  const { classSection } = data

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          href="/admin/class-sections"
        >
          Back to class sections
        </Link>
        <AdminPageHeader
          title={classSection.name}
          description="Manage section details, instructors, and enrollments."
        />
      </div>

      <FormCard title="Section summary">
        <dl className="grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
          <SummaryItem label="Course" value={classSection.course.title} />
          <SummaryItem label="Term" value={classSection.term?.name ?? "-"} />
          <SummaryItem
            label="Campus"
            value={classSection.campus?.name ?? "Organization-wide"}
          />
          <SummaryItem
            label="Academic year"
            value={
              data.academicYears.find(
                (year) => year.id === classSection.academicYearId
              )?.name ?? "-"
            }
          />
          <SummaryItem label="Mode" value={classSection.deliveryMode} />
          <SummaryItem
            label="Credit"
            value={classSection.course.credits?.toString() ?? "-"}
          />
          <SummaryItem
            label="Capacity"
            value={classSection.capacity?.toString() ?? "-"}
          />
          <SummaryItem
            label="Grade level"
            value={
              data.gradeLevels.find(
                (gradeLevel) => gradeLevel.id === classSection.gradeLevelId
              )?.name ?? "-"
            }
          />
          <SummaryItem
            label="Homeroom"
            value={
              data.homerooms.find(
                (homeroom) => homeroom.id === classSection.homeroomId
              )?.name ?? "-"
            }
          />
          <SummaryItem
            label="Students"
            value={`${classSection._count.enrollments} ${
              classSection._count.enrollments === 1 ? "student" : "students"
            }`}
          />
        </dl>
      </FormCard>

      <ClassSectionForm data={data} section={classSection} />
      <InstructorManagement data={data} section={classSection} />
      <EnrollmentManagement data={data} section={classSection} />
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
