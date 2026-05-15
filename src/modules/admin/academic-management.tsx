import { DeliveryMode, EnrollmentStatus } from "@prisma/client"

import { Button } from "@/components/ui/button"
import {
  assignClassSectionInstructor,
  assignStudentToHomeroom,
  enrollHomeroomInClassSection,
  removeClassSectionInstructor,
  removeEnrollment,
  removeStudentFromHomeroom,
  saveClassSection,
  saveEnrollment,
  saveHomeroom,
} from "@/modules/admin/actions"
import {
  AdminSelect,
  DataTable,
  Field,
  FormCard,
  SubmitButton,
  TableCell,
  TableRow,
} from "@/modules/admin/components"
import { getAcademicSetupOptions } from "@/modules/admin/data"

export type AdminData = Awaited<ReturnType<typeof getAcademicSetupOptions>>
export type ClassSection = AdminData["classSections"][number]
export type Homeroom = AdminData["homerooms"][number]

export function ClassSectionForm({
  data,
  section,
}: {
  data: AdminData
  section?: ClassSection
}) {
  return (
    <FormCard title={section ? "Edit class section" : "Create class section"}>
      <form
        action={saveClassSection}
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
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

export function InstructorManagement({
  data,
  section,
}: {
  data: AdminData
  section: ClassSection
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
      <FormCard title="Assigned instructors">
        <DataTable
          empty="No instructors assigned."
          headers={["Name", "Email", "Role", "Action"]}
          minWidth="min-w-[640px]"
          rows={section.instructors.map((assignment) => (
            <TableRow key={assignment.id}>
              <TableCell className="font-medium">
                {assignment.instructor.name}
              </TableCell>
              <TableCell>{assignment.instructor.email ?? "-"}</TableCell>
              <TableCell className="whitespace-nowrap">
                {assignment.roleLabel ??
                  (assignment.isPrimary ? "PRIMARY" : "ASSISTANT")}
              </TableCell>
              <TableCell>
                <form action={removeClassSectionInstructor}>
                  <input
                    name="assignmentId"
                    type="hidden"
                    value={assignment.id}
                  />
                  <Button size="sm" type="submit" variant="outline">
                    Remove
                  </Button>
                </form>
              </TableCell>
            </TableRow>
          ))}
        />
      </FormCard>
      <FormCard title="Assign instructor">
        <form
          action={assignClassSectionInstructor}
          className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1"
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
          <SubmitButton label="Assign" />
        </form>
      </FormCard>
    </div>
  )
}

export function EnrollmentManagement({
  data,
  section,
}: {
  data: AdminData
  section: ClassSection
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
      <FormCard title="Enrolled students">
        <DataTable
          empty="No students enrolled."
          headers={["Student", "Email", "Grade", "Homeroom", "Status", "Action"]}
          minWidth="min-w-[860px]"
          rows={section.enrollments.map((enrollment) => (
            <TableRow key={enrollment.id}>
              <TableCell className="font-medium">
                {enrollment.student.name}
              </TableCell>
              <TableCell>{enrollment.student.email ?? "-"}</TableCell>
              <TableCell>
                {enrollment.student.studentProfile?.currentGradeLevel?.name ??
                  "-"}
              </TableCell>
              <TableCell>
                {enrollment.student.studentProfile?.homeroom?.name ?? "-"}
              </TableCell>
              <TableCell>
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
              </TableCell>
              <TableCell>
                <form action={removeEnrollment}>
                  <input
                    name="enrollmentId"
                    type="hidden"
                    value={enrollment.id}
                  />
                  <Button size="sm" type="submit" variant="outline">
                    Remove
                  </Button>
                </form>
              </TableCell>
            </TableRow>
          ))}
        />
      </FormCard>
      <div className="space-y-4">
        <FormCard title="Enroll student">
          <form action={saveEnrollment} className="grid gap-3">
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
            <SubmitButton label="Enroll" />
          </form>
        </FormCard>
        <FormCard title="Bulk enroll homeroom">
          <form action={enrollHomeroomInClassSection} className="grid gap-3">
            <input name="classSectionId" type="hidden" value={section.id} />
            <AdminSelect
              includeEmpty={false}
              label="Homeroom"
              name="homeroomId"
              options={data.homeroomOptions}
              required
            />
            <SubmitButton label="Enroll all" />
          </form>
        </FormCard>
      </div>
    </div>
  )
}

export function HomeroomForm({
  data,
  homeroom,
}: {
  data: AdminData
  homeroom?: Homeroom
}) {
  return (
    <FormCard title={homeroom ? "Edit homeroom" : "Create homeroom"}>
      <form
        action={saveHomeroom}
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        <input name="id" type="hidden" value={homeroom?.id ?? ""} />
        <AdminSelect
          includeEmpty={false}
          label="Organization"
          name="organizationId"
          options={data.organizationOptions}
          defaultValue={homeroom?.organizationId}
          required
        />
        <AdminSelect
          label="Campus"
          name="campusId"
          options={data.campusOptions}
          defaultValue={homeroom?.campusId}
        />
        <AdminSelect
          includeEmpty={false}
          label="Academic year"
          name="academicYearId"
          options={data.academicYearOptions}
          defaultValue={homeroom?.academicYearId}
          required
        />
        <AdminSelect
          label="Grade level"
          name="gradeLevelId"
          options={data.gradeLevelOptions}
          defaultValue={homeroom?.gradeLevelId}
        />
        <AdminSelect
          label="Teacher"
          name="teacherId"
          options={data.instructorOptions}
          defaultValue={homeroom?.teacherId}
        />
        <Field label="Name" name="name" defaultValue={homeroom?.name} required />
        <div className="flex items-end">
          <SubmitButton />
        </div>
      </form>
    </FormCard>
  )
}

export function HomeroomStudentManagement({
  data,
  homeroom,
}: {
  data: AdminData
  homeroom: Homeroom
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
      <FormCard title="Assigned students">
        <DataTable
          empty="No students assigned."
          headers={["Student", "Email", "Grade", "Action"]}
          minWidth="min-w-[680px]"
          rows={homeroom.studentProfiles.map((profile) => (
            <TableRow key={profile.id}>
              <TableCell className="font-medium">{profile.user.name}</TableCell>
              <TableCell>{profile.user.email ?? "-"}</TableCell>
              <TableCell>{homeroom.gradeLevel?.name ?? "-"}</TableCell>
              <TableCell>
                <form action={removeStudentFromHomeroom}>
                  <input name="studentId" type="hidden" value={profile.userId} />
                  <input name="homeroomId" type="hidden" value={homeroom.id} />
                  <Button size="sm" type="submit" variant="outline">
                    Remove
                  </Button>
                </form>
              </TableCell>
            </TableRow>
          ))}
        />
      </FormCard>
      <FormCard title="Assign student">
        <form action={assignStudentToHomeroom} className="grid gap-3">
          <input name="homeroomId" type="hidden" value={homeroom.id} />
          <AdminSelect
            includeEmpty={false}
            label="Student"
            name="studentId"
            options={data.studentOptions}
            required
          />
          <SubmitButton label="Assign" />
        </form>
      </FormCard>
    </div>
  )
}
