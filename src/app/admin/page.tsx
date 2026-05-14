import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getPrismaClient } from "@/lib/prisma"
import { getAdminData } from "@/modules/admin/data"
import { AdminLinkGrid, AdminPageHeader } from "@/modules/admin/components"

export default async function AdminPage() {
  const admin = await getAdminData()
  const prisma = getPrismaClient()
  const [
    campusCount,
    yearCount,
    courseCount,
    classSectionCount,
    userCount,
  ] = await Promise.all([
    prisma.campus.count({ where: admin.scope }),
    prisma.academicYear.count({ where: admin.scope }),
    prisma.course.count({ where: admin.scope }),
    prisma.classSection.count({ where: admin.scope }),
    prisma.user.count({
      where: {
        organizationId: { in: admin.organizations.map((org) => org.id) },
      },
    }),
  ])

  const metrics = [
    ["Organizations", admin.organizations.length],
    ["Campuses", campusCount],
    ["Academic Years", yearCount],
    ["Courses", courseCount],
    ["Class Sections", classSectionCount],
    ["Users", userCount],
  ] as const

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Admin overview"
        description="Start with academic years, terms, courses, and class sections."
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map(([label, value]) => (
          <Card key={label}>
            <CardHeader>
              <CardTitle className="text-sm text-muted-foreground">
                {label}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{value}</CardContent>
          </Card>
        ))}
      </div>
      <AdminLinkGrid />
    </div>
  )
}
