import { DeliveryMode } from "@prisma/client"

import { saveCourse } from "@/modules/admin/actions"
import {
  AdminPageHeader,
  AdminSelect,
  DataTable,
  Field,
  FormCard,
  matchesSearch,
  SearchForm,
  SubmitButton,
  TableCell,
  TableRow,
} from "@/modules/admin/components"
import { getAcademicSetupOptions } from "@/modules/admin/data"

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const data = await getAcademicSetupOptions()
  const q = (await searchParams).q?.trim() ?? ""
  const courses = data.courses.filter((course) =>
    matchesSearch(q, [
      course.title,
      course.code,
      course.description,
      course.campus?.name,
      course.organization.name,
      data.departments.find((department) => department.id === course.departmentId)
        ?.name,
    ])
  )

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Courses"
        description="Create reusable course records with credits and delivery defaults."
      />
      <SearchForm
        q={q}
        placeholder="Search courses..."
        resultSummary={`${courses.length} of ${data.courses.length} courses shown`}
      />
      <CourseForm data={data} />
      <DataTable
        empty="No courses yet."
        headers={["Title", "Code", "Credits", "Department", "Mode", "Edit"]}
        rows={courses.map((course) => (
          <TableRow key={course.id}>
            <TableCell className="font-medium">{course.title}</TableCell>
            <TableCell>{course.code ?? "-"}</TableCell>
            <TableCell>{course.credits?.toString() ?? "-"}</TableCell>
            <TableCell>
              {data.departments.find(
                (department) => department.id === course.departmentId
              )?.name ?? "-"}
            </TableCell>
            <TableCell>{course.defaultDeliveryMode}</TableCell>
            <TableCell>
              <CourseForm data={data} course={course} />
            </TableCell>
          </TableRow>
        ))}
      />
    </div>
  )
}

function CourseForm({
  data,
  course,
}: {
  data: Awaited<ReturnType<typeof getAcademicSetupOptions>>
  course?: {
    id: string
    organizationId: string
    campusId: string | null
    departmentId: string | null
    code: string | null
    title: string
    description: string | null
    credits: { toString(): string } | null
    defaultDeliveryMode: DeliveryMode
  }
}) {
  return (
    <FormCard title={course ? "Edit course" : "Create course"}>
      <form action={saveCourse} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <input name="id" type="hidden" value={course?.id ?? ""} />
        <AdminSelect
          includeEmpty={false}
          label="Organization"
          name="organizationId"
          options={data.organizationOptions}
          defaultValue={course?.organizationId}
          required
        />
        <AdminSelect
          label="Campus"
          name="campusId"
          options={data.campusOptions}
          defaultValue={course?.campusId}
        />
        <AdminSelect
          label="Department"
          name="departmentId"
          options={data.departmentOptions}
          defaultValue={course?.departmentId}
        />
        <Field label="Code" name="code" defaultValue={course?.code} />
        <Field label="Title" name="title" defaultValue={course?.title} required />
        <Field
          label="Credits"
          name="credits"
          type="number"
          defaultValue={course?.credits?.toString() ?? ""}
        />
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Default delivery</span>
          <select
            className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
            name="defaultDeliveryMode"
            defaultValue={course?.defaultDeliveryMode ?? DeliveryMode.OFFLINE}
          >
            {Object.values(DeliveryMode).map((mode) => (
              <option key={mode} value={mode}>
                {mode}
              </option>
            ))}
          </select>
        </label>
        <Field
          label="Description"
          name="description"
          defaultValue={course?.description}
        />
        <div className="flex items-end">
          <SubmitButton />
        </div>
      </form>
    </FormCard>
  )
}
