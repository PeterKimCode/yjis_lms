import { assignStudentToHomeroom, saveHomeroom } from "@/modules/admin/actions"
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

type AdminData = Awaited<ReturnType<typeof getAcademicSetupOptions>>
type Homeroom = AdminData["homerooms"][number]

export default async function HomeroomsPage() {
  const data = await getAcademicSetupOptions()

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Homerooms"
        description="Manage K-12 homerooms, advisor assignments, and student placement."
      />
      <HomeroomForm data={data} />
      <DataTable
        empty="No homerooms yet."
        headers={[
          "Name",
          "Grade",
          "Campus",
          "Academic Year",
          "Teacher",
          "Students",
          "Manage",
        ]}
        rows={data.homerooms.map((homeroom) => (
          <TableRow key={homeroom.id} className="align-top">
            <TableCell className="font-medium">{homeroom.name}</TableCell>
            <TableCell>{homeroom.gradeLevel?.name ?? "-"}</TableCell>
            <TableCell>{homeroom.campus?.name ?? "Organization-wide"}</TableCell>
            <TableCell>
              {data.academicYears.find(
                (year) => year.id === homeroom.academicYearId
              )?.name ?? "-"}
            </TableCell>
            <TableCell>
              {homeroom.teacher
                ? `${homeroom.teacher.name}${
                    homeroom.teacher.email ? ` (${homeroom.teacher.email})` : ""
                  }`
                : "-"}
            </TableCell>
            <TableCell>
              <HomeroomStudentList homeroom={homeroom} />
            </TableCell>
            <TableCell className="min-w-[420px]">
              <div className="space-y-4">
                <HomeroomForm data={data} homeroom={homeroom} />
                <AssignStudentForm data={data} homeroom={homeroom} />
              </div>
            </TableCell>
          </TableRow>
        ))}
      />
    </div>
  )
}

function HomeroomStudentList({ homeroom }: { homeroom: Homeroom }) {
  if (!homeroom.studentProfiles.length) {
    return <span>0 students</span>
  }

  return (
    <div className="space-y-1 text-sm">
      <div className="font-medium">{homeroom._count.studentProfiles} students</div>
      {homeroom.studentProfiles.map((profile) => (
        <div key={profile.id}>
          {profile.user.name}
          <span className="text-xs text-muted-foreground">
            {profile.user.email ? ` (${profile.user.email})` : ""}
          </span>
        </div>
      ))}
    </div>
  )
}

function HomeroomForm({
  data,
  homeroom,
}: {
  data: AdminData
  homeroom?: Homeroom
}) {
  return (
    <FormCard title={homeroom ? "Edit homeroom" : "Create homeroom"}>
      <form action={saveHomeroom} className="grid gap-3 md:grid-cols-4">
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

function AssignStudentForm({
  data,
  homeroom,
}: {
  data: AdminData
  homeroom: Homeroom
}) {
  return (
    <FormCard title="Assign student">
      <form action={assignStudentToHomeroom} className="grid gap-3 md:grid-cols-2">
        <input name="homeroomId" type="hidden" value={homeroom.id} />
        <AdminSelect
          includeEmpty={false}
          label="Student"
          name="studentId"
          options={data.studentOptions}
          required
        />
        <div className="flex items-end">
          <SubmitButton label="Assign" />
        </div>
      </form>
    </FormCard>
  )
}
