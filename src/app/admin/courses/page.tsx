import { UserDeletionRequestStatus } from "@prisma/client"

import { FormDialog } from "@/components/form-dialog"
import { getPrismaClient } from "@/lib/prisma"
import {
  CourseForm,
  type CourseFormData,
  type CourseFormValue,
} from "@/modules/admin/course-form"
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
import {
  PendingResourceDeletionRequests,
  ResourceDeleteControl,
  ResourceDeletionStatusBanners,
} from "@/modules/admin/resource-deletion-components"
import { hasSuperAdminRole } from "@/modules/admin/scope-rules"

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{
    deleted?: string
    deleteError?: string
    deleteRequested?: string
    organizationId?: string
    q?: string
    requestError?: string
    reviewed?: string
    reviewError?: string
  }>
}) {
  const data = await getAcademicSetupOptions()
  const formData = toCourseFormData(data)
  const params = await searchParams
  const organizationId = params.organizationId?.trim() ?? ""
  const q = params.q?.trim() ?? ""
  const courses = data.courses
    .filter((course) => !organizationId || course.organizationId === organizationId)
    .filter((course) =>
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
  const canDeleteDirectly = hasSuperAdminRole(data.user.roleAssignments)
  const pendingDeletionRequests = await getPrismaClient().resourceDeletionRequest.findMany({
    where: {
      entityType: "course",
      status: UserDeletionRequestStatus.PENDING,
      ...(canDeleteDirectly ? {} : { requestedById: data.user.id }),
      ...(data.courses.length
        ? { entityId: { in: data.courses.map((course) => course.id) } }
        : { entityId: "__none__" }),
    },
    include: {
      organization: { select: { name: true } },
      requestedBy: { select: { email: true, name: true } },
    },
    orderBy: { requestedAt: "desc" },
  })
  const pendingDeletionByCourseId = new Map(
    pendingDeletionRequests.map((request) => [request.entityId, request])
  )

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Courses"
        description="Create reusable course records with credits and delivery defaults."
      />
      <SearchForm
        hiddenFields={{ organizationId }}
        q={q}
        placeholder="Search courses..."
        resetHref={
          organizationId ? `/admin/courses?organizationId=${organizationId}` : "?"
        }
        resultSummary={`${courses.length} of ${data.courses.length} courses shown`}
      />
      <DeleteStatusBanner deleted={params.deleted} deleteError={params.deleteError} />
      <ResourceDeletionStatusBanners entityLabel="Course" params={params} />
      {canDeleteDirectly ? (
        <PendingResourceDeletionRequests
          requests={pendingDeletionRequests}
          returnPath="/admin/courses"
          title="Pending course deletion requests"
        />
      ) : null}
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
              <ResourceDeleteControl
                canDeleteDirectly={canDeleteDirectly}
                entity="course"
                id={course.id}
                isRequested={pendingDeletionByCourseId.has(course.id)}
                label={course.title}
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
