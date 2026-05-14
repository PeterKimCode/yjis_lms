import Link from "next/link"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getPrismaClient } from "@/lib/prisma"
import {
  getAcademicYearWhereForAdmin,
  getCampusWhereForAdmin,
  getClassSectionWhereForAdmin,
  getCourseWhereForAdmin,
  getUserWhereForAdmin,
} from "@/modules/admin/access"
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
    prisma.campus.count({ where: getCampusWhereForAdmin(admin.user) }),
    prisma.academicYear.count({
      where: getAcademicYearWhereForAdmin(admin.user),
    }),
    prisma.course.count({ where: getCourseWhereForAdmin(admin.user) }),
    prisma.classSection.count({
      where: getClassSectionWhereForAdmin(admin.user),
    }),
    prisma.user.count({ where: getUserWhereForAdmin(admin.user) }),
  ])

  const metrics = [
    ["Organizations", admin.organizations.length, "/admin/organizations"],
    ["Campuses", campusCount, "/admin/campuses"],
    ["Academic Years", yearCount, "/admin/academic-years"],
    ["Courses", courseCount, "/admin/courses"],
    ["Class Sections", classSectionCount, "/admin/class-sections"],
    ["Users", userCount, "/admin/users"],
  ] as const

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Admin overview"
        description="Start with academic years, terms, courses, and class sections."
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map(([label, value, href]) => (
          <Link href={href} key={label}>
            <Card className="transition-colors hover:bg-muted/60">
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">
                  {label}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold">
                {value}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      <AdminLinkGrid />
    </div>
  )
}
