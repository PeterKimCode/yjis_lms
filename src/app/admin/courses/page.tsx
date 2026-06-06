import { FormDialog } from "@/components/form-dialog"
import {
  CourseForm,
  type CourseFormData,
  type CourseFormValue,
} from "@/modules/admin/course-form"
import { deleteAdminEntity } from "@/modules/admin/actions"
import {
  AdminPageHeader,
  DataTable,
  DeleteStatusBanner,
  matchesSearch,
  SearchForm,
  TableCell,
  TableRow,
} from "@/modules/admin/components"
import { getAcademicSetupOptions } from "@/modules/admin/data"
import { ConfirmDeleteForm } from "@/modules/admin/delete-button"

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string; deleteError?: string; q?: string }>
}) {
  const data = await getAcademicSetupOptions()
  const formData = toCourseFormData(data)
  const params = await searchParams
  const q = params.q?.trim() ?? ""
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
      <DeleteStatusBanner deleted={params.deleted} deleteError={params.deleteError} />
      <CourseForm data={formData} />
      <DataTable
        empty="No courses yet."
        headers={["Title", "Code", "Credits", "Department", "Mode", "Edit", "Delete"]}
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
              <FormDialog
                description="Update course details, credits, department, and default delivery mode."
                title={`Edit course: ${course.title}`}
                trigger="Edit"
                variant="outline"
              >
                <CourseForm data={formData} course={toCourseFormValue(course)} />
              </FormDialog>
            </TableCell>
            <TableCell>
              <ConfirmDeleteForm
                action={deleteAdminEntity}
                entity="course"
                id={course.id}
                message={`Delete course "${course.title}"? Related class sections may prevent deletion.`}
                returnPath="/admin/courses"
              />
            </TableCell>
          </TableRow>
        ))}
      />
    </div>
  )
}

function toCourseFormData(
  data: Awaited<ReturnType<typeof getAcademicSetupOptions>>
): CourseFormData {
  return {
    organizationOptions: data.organizationOptions,
    campusOptions: data.campusOptions,
    departmentOptions: data.departmentOptions,
  }
}

function toCourseFormValue(
  course: Awaited<ReturnType<typeof getAcademicSetupOptions>>["courses"][number]
): CourseFormValue {
  return {
    id: course.id,
    organizationId: course.organizationId,
    campusId: course.campusId,
    departmentId: course.departmentId,
    code: course.code,
    title: course.title,
    description: course.description,
    credits: course.credits?.toString() ?? "",
    defaultDeliveryMode: course.defaultDeliveryMode,
  }
}
