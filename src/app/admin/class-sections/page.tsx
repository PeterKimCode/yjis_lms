import { DeliveryMode } from "@prisma/client"

import { saveClassSection } from "@/modules/admin/actions"
import {
  AdminPageHeader,
  AdminSelect,
  DataTable,
  Field,
  FormCard,
  SubmitButton,
  TableCell,
  TableRow,
} from "@/modules/admin/components"
import { getAcademicSetupOptions } from "@/modules/admin/data"

export default async function ClassSectionsPage() {
  const data = await getAcademicSetupOptions()

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Class sections"
        description="Open course sections for online, offline, and hybrid delivery."
      />
      <ClassSectionForm data={data} />
      <DataTable
        empty="No class sections yet."
        headers={["Name", "Course", "Term", "Mode", "Capacity", "Edit"]}
        rows={data.classSections.map((section) => (
          <TableRow key={section.id}>
            <TableCell className="font-medium">{section.name}</TableCell>
            <TableCell>
              {data.courses.find((course) => course.id === section.courseId)
                ?.title ?? "-"}
            </TableCell>
            <TableCell>
              {data.terms.find((term) => term.id === section.termId)?.name ?? "-"}
            </TableCell>
            <TableCell>{section.deliveryMode}</TableCell>
            <TableCell>{section.capacity ?? "-"}</TableCell>
            <TableCell>
              <ClassSectionForm data={data} section={section} />
            </TableCell>
          </TableRow>
        ))}
      />
    </div>
  )
}

function ClassSectionForm({
  data,
  section,
}: {
  data: Awaited<ReturnType<typeof getAcademicSetupOptions>>
  section?: {
    id: string
    organizationId: string
    campusId: string | null
    academicYearId: string
    termId: string | null
    courseId: string
    gradeLevelId: string | null
    homeroomId: string | null
    name: string
    sectionCode: string | null
    deliveryMode: DeliveryMode
    capacity: number | null
  }
}) {
  return (
    <FormCard title={section ? "Edit class section" : "Create class section"}>
      <form action={saveClassSection} className="grid gap-3 md:grid-cols-4">
        <input name="id" type="hidden" value={section?.id ?? ""} />
        <AdminSelect
          includeEmpty={false}
          label="Organization"
          name="organizationId"
          options={data.organizationOptions}
          defaultValue={section?.organizationId}
          required
        />
        <AdminSelect
          label="Campus"
          name="campusId"
          options={data.campusOptions}
          defaultValue={section?.campusId}
        />
        <AdminSelect
          includeEmpty={false}
          label="Academic year"
          name="academicYearId"
          options={data.academicYearOptions}
          defaultValue={section?.academicYearId}
          required
        />
        <AdminSelect
          label="Term"
          name="termId"
          options={data.termOptions}
          defaultValue={section?.termId}
        />
        <AdminSelect
          includeEmpty={false}
          label="Course"
          name="courseId"
          options={data.courseOptions}
          defaultValue={section?.courseId}
          required
        />
        <AdminSelect
          label="Grade level"
          name="gradeLevelId"
          options={data.gradeLevelOptions}
          defaultValue={section?.gradeLevelId}
        />
        <AdminSelect
          label="Homeroom"
          name="homeroomId"
          options={data.homeroomOptions}
          defaultValue={section?.homeroomId}
        />
        <Field label="Name" name="name" defaultValue={section?.name} required />
        <Field
          label="Section code"
          name="sectionCode"
          defaultValue={section?.sectionCode}
        />
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Delivery mode</span>
          <select
            className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
            name="deliveryMode"
            defaultValue={section?.deliveryMode ?? DeliveryMode.OFFLINE}
          >
            {Object.values(DeliveryMode).map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </select>
        </label>
        <Field
          label="Capacity"
          name="capacity"
          type="number"
          defaultValue={section?.capacity}
        />
        <div className="flex items-end">
          <SubmitButton />
        </div>
      </form>
    </FormCard>
  )
}
