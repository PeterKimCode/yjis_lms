import { DeliveryMode, EnrollmentStatus } from "@prisma/client"

import {
  assignClassSectionInstructor,
  enrollHomeroomInClassSection,
  removeClassSectionInstructor,
  removeEnrollment,
  saveClassSection,
  saveEnrollment,
} from "@/modules/admin/actions"
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
import { Button } from "@/components/ui/button"

type AdminData = Awaited<ReturnType<typeof getAcademicSetupOptions>>
type ClassSection = AdminData["classSections"][number]

export default async function ClassSectionsPage() {
  const data = await getAcademicSetupOptions()

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Class sections"
        description="Open course sections, assign instructors, and manage enrollments."
      />
      <ClassSectionForm data={data} />
      <DataTable
        empty="No class sections yet."
        headers={[
          "Section",
          "Course",
          "Term",
          "Campus",
          "Mode",
          "Credit",
          "Instructors",
          "Students",
          "Manage",
        ]}
        rows={data.classSections.map((section) => (
          <TableRow key={section.id} className="align-top">
            <TableCell className="font-medium">
              <div>{section.name}</div>
              <div className="text-xs text-muted-foreground">
                {section.sectionCode ?? "No section code"}
              </div>
            </TableCell>
            <TableCell>{section.course.title}</TableCell>
            <TableCell>{section.term?.name ?? "-"}</TableCell>
            <TableCell>{section.campus?.name ?? "Organization-wide"}</TableCell>
            <TableCell>{section.deliveryMode}</TableCell>
            <TableCell>{section.course.credits?.toString() ?? "-"}</TableCell>
            <TableCell>
              <InstructorList section={section} />
            </TableCell>
            <TableCell>
              <EnrollmentList section={section} />
            </TableCell>
            <TableCell className="min-w-[520px]">
              <div className="space-y-4">
                <ClassSectionForm data={data} section={section} />
                <InstructorAssignmentForm data={data} section={section} />
                <EnrollmentForm data={data} section={section} />
                <BulkHomeroomEnrollmentForm data={data} section={section} />
              </div>
            </TableCell>
          </TableRow>
        ))}
      />
    </div>
  )
}

function InstructorList({ section }: { section: ClassSection }) {
  if (!section.instructors.length) return <span>-</span>

  return (
    <div className="space-y-2">
      {section.instructors.map((assignment) => (
        <div className="space-y-1 text-sm" key={assignment.id}>
          <div className="font-medium">{assignment.instructor.name}</div>
          <div className="text-xs text-muted-foreground">
            {assignment.instructor.email ?? "-"} -{" "}
            {assignment.roleLabel ?? (assignment.isPrimary ? "PRIMARY" : "ASSISTANT")}
          </div>
          <form action={removeClassSectionInstructor}>
            <input name="assignmentId" type="hidden" value={assignment.id} />
            <Button size="sm" type="submit" variant="outline">
              Remove
            </Button>
          </form>
        </div>
      ))}
    </div>
  )
}

function EnrollmentList({ section }: { section: ClassSection }) {
  if (!section.enrollments.length) return <span>0 students</span>

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">
        {section._count.enrollments} enrolled records
      </div>
      {section.enrollments.map((enrollment) => (
        <div className="space-y-1 text-sm" key={enrollment.id}>
          <div className="font-medium">{enrollment.student.name}</div>
          <div className="text-xs text-muted-foreground">
            {enrollment.student.email ?? "-"} - {enrollment.status}
            {enrollment.student.studentProfile?.homeroom
              ? ` - ${enrollment.student.studentProfile.homeroom.name}`
              : ""}
          </div>
          <div className="flex flex-wrap gap-2">
            <form action={saveEnrollment} className="flex gap-2">
              <input
                name="classSectionId"
                type="hidden"
                value={section.id}
              />
              <input
                name="studentId"
                type="hidden"
                value={enrollment.studentId}
              />
              <select
                className="h-8 rounded-lg border border-input bg-background px-2 text-xs"
                name="status"
                defaultValue={enrollment.status}
              >
                {Object.values(EnrollmentStatus).map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <Button size="sm" type="submit" variant="outline">
                Update
              </Button>
            </form>
            <form action={removeEnrollment}>
              <input name="enrollmentId" type="hidden" value={enrollment.id} />
              <Button size="sm" type="submit" variant="outline">
                Remove
              </Button>
            </form>
          </div>
        </div>
      ))}
    </div>
  )
}

function ClassSectionForm({
  data,
  section,
}: {
  data: AdminData
  section?: ClassSection
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
        <Field label="Title" name="name" defaultValue={section?.name} required />
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

function InstructorAssignmentForm({
  data,
  section,
}: {
  data: AdminData
  section: ClassSection
}) {
  return (
    <FormCard title="Assign instructor">
      <form
        action={assignClassSectionInstructor}
        className="grid gap-3 md:grid-cols-3"
      >
        <input name="classSectionId" type="hidden" value={section.id} />
        <AdminSelect
          includeEmpty={false}
          label="Instructor"
          name="instructorId"
          options={data.instructorOptions}
          required
        />
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Role</span>
          <select
            className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
            name="roleLabel"
            defaultValue="PRIMARY"
          >
            {["PRIMARY", "ASSISTANT", "TA"].map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <SubmitButton label="Assign" />
        </div>
      </form>
    </FormCard>
  )
}

function EnrollmentForm({
  data,
  section,
}: {
  data: AdminData
  section: ClassSection
}) {
  return (
    <FormCard title="Enroll student">
      <form action={saveEnrollment} className="grid gap-3 md:grid-cols-3">
        <input name="classSectionId" type="hidden" value={section.id} />
        <AdminSelect
          includeEmpty={false}
          label="Student"
          name="studentId"
          options={data.studentOptions}
          required
        />
        <label className="grid gap-1 text-sm">
          <span className="font-medium">Status</span>
          <select
            className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
            name="status"
            defaultValue={EnrollmentStatus.ENROLLED}
          >
            {Object.values(EnrollmentStatus).map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <SubmitButton label="Enroll" />
        </div>
      </form>
    </FormCard>
  )
}

function BulkHomeroomEnrollmentForm({
  data,
  section,
}: {
  data: AdminData
  section: ClassSection
}) {
  return (
    <FormCard title="Bulk enroll homeroom">
      <form
        action={enrollHomeroomInClassSection}
        className="grid gap-3 md:grid-cols-2"
      >
        <input name="classSectionId" type="hidden" value={section.id} />
        <AdminSelect
          includeEmpty={false}
          label="Homeroom"
          name="homeroomId"
          options={data.homeroomOptions}
          required
        />
        <div className="flex items-end">
          <SubmitButton label="Enroll all" />
        </div>
      </form>
    </FormCard>
  )
}
