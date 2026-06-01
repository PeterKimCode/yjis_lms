import {
  CourseForm,
  type CourseFormData,
  type CourseFormValue,
} from "@/modules/admin/course-form"
import {
  AdminPageHeader,
  DataTable,
  matchesSearch,
  SearchForm,
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
  const formData = toCourseFormData(data)
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
      <CourseForm data={formData} />
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
              <CourseForm data={formData} course={toCourseFormValue(course)} />
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
    instructorOptions: data.instructorOptions,
    studentOptions: data.studentOptions,
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
