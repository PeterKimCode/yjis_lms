import { PrismaPg } from "@prisma/adapter-pg"
import bcrypt from "bcryptjs"

import {
  BoardScopeType,
  BoardType,
  DeliveryMode,
  EnrollmentStatus,
  InstitutionType,
  PrismaClient,
  UserRole,
} from "@prisma/client"
import {
  getBoardScopeTypeForKind,
  getBoardTypeForKind,
  type BoardKind,
} from "../src/modules/boards/constants"
import {
  ensureDefaultGradingScaleForOrganization,
  ensureDefaultPoliciesForCampus,
  ensureDefaultPoliciesForOrganization,
} from "../src/modules/policies/initialize"

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to run the seed script.")
}

const adapter = new PrismaPg({ connectionString: databaseUrl })
const prisma = new PrismaClient({ adapter })
const demoPassword = "DemoPass123!"

async function main() {
  const passwordHash = await bcrypt.hash(demoPassword, 12)

  const organization = await prisma.organization.upsert({
    where: { slug: "demo-education-organization" },
    update: {
      name: "Demo Education Organization",
      institutionType: InstitutionType.ONLINE_SCHOOL,
      isActive: true,
    },
    create: {
      name: "Demo Education Organization",
      slug: "demo-education-organization",
      institutionType: InstitutionType.ONLINE_SCHOOL,
      isActive: true,
    },
  })

  const campus = await upsertCampus(organization.id)

  const superAdmin = await upsertUser(
    organization.id,
    "super.admin@demo.local",
    "Demo Super Admin",
    passwordHash
  )
  const schoolAdmin = await upsertUser(
    organization.id,
    "school.admin@demo.local",
    "Demo School Admin",
    passwordHash
  )
  const instructor = await upsertUser(
    organization.id,
    "instructor@demo.local",
    "Demo Instructor",
    passwordHash
  )
  const student = await upsertUser(
    organization.id,
    "student@demo.local",
    "Demo Student",
    passwordHash
  )
  const parent = await upsertUser(
    organization.id,
    "parent@demo.local",
    "Demo Parent",
    passwordHash
  )

  await Promise.all([
    ensureRole(organization.id, null, superAdmin.id, UserRole.SUPER_ADMIN),
    ensureRole(organization.id, campus.id, schoolAdmin.id, UserRole.SCHOOL_ADMIN),
    ensureRole(organization.id, campus.id, instructor.id, UserRole.INSTRUCTOR),
    ensureRole(organization.id, campus.id, student.id, UserRole.STUDENT),
    ensureRole(organization.id, campus.id, parent.id, UserRole.PARENT),
  ])

  const academicYear = await findOrCreateAcademicYear(organization.id, campus.id)
  const term = await findOrCreateTerm(organization.id, campus.id, academicYear.id)
  const gradeLevel = await findOrCreateGradeLevel(
    organization.id,
    campus.id,
    academicYear.id
  )
  const homeroom = await findOrCreateHomeroom(
    organization.id,
    campus.id,
    academicYear.id,
    gradeLevel.id,
    instructor.id
  )
  const department = await findOrCreateDepartment(organization.id, campus.id)
  const course = await findOrCreateCourse(
    organization.id,
    campus.id,
    department.id
  )
  const classSection = await findOrCreateClassSection({
    organizationId: organization.id,
    campusId: campus.id,
    academicYearId: academicYear.id,
    termId: term.id,
    courseId: course.id,
    gradeLevelId: gradeLevel.id,
    homeroomId: homeroom.id,
  })

  await prisma.studentProfile.upsert({
    where: { userId: student.id },
    update: {
      organizationId: organization.id,
      campusId: campus.id,
      currentGradeLevelId: gradeLevel.id,
      homeroomId: homeroom.id,
      studentNumber: "DEMO-STUDENT-001",
      admissionDate: new Date("2026-03-01T00:00:00.000Z"),
    },
    create: {
      organizationId: organization.id,
      campusId: campus.id,
      userId: student.id,
      studentNumber: "DEMO-STUDENT-001",
      currentGradeLevelId: gradeLevel.id,
      homeroomId: homeroom.id,
      admissionDate: new Date("2026-03-01T00:00:00.000Z"),
    },
  })

  await prisma.instructorProfile.upsert({
    where: { userId: instructor.id },
    update: {
      organizationId: organization.id,
      campusId: campus.id,
      employeeNumber: "DEMO-INSTRUCTOR-001",
      title: "Instructor",
    },
    create: {
      organizationId: organization.id,
      campusId: campus.id,
      userId: instructor.id,
      employeeNumber: "DEMO-INSTRUCTOR-001",
      title: "Instructor",
    },
  })

  await prisma.parentStudentRelation.upsert({
    where: {
      parentId_studentId: {
        parentId: parent.id,
        studentId: student.id,
      },
    },
    update: {
      relation: "Guardian",
      isPrimary: true,
    },
    create: {
      organizationId: organization.id,
      parentId: parent.id,
      studentId: student.id,
      relation: "Guardian",
      isPrimary: true,
    },
  })

  await prisma.classSectionInstructor.upsert({
    where: {
      classSectionId_instructorId: {
        classSectionId: classSection.id,
        instructorId: instructor.id,
      },
    },
    update: {
      roleLabel: "Lead Instructor",
      isPrimary: true,
    },
    create: {
      organizationId: organization.id,
      classSectionId: classSection.id,
      instructorId: instructor.id,
      roleLabel: "Lead Instructor",
      isPrimary: true,
    },
  })

  await prisma.enrollment.upsert({
    where: {
      classSectionId_studentId: {
        classSectionId: classSection.id,
        studentId: student.id,
      },
    },
    update: {
      campusId: campus.id,
      status: EnrollmentStatus.ENROLLED,
    },
    create: {
      organizationId: organization.id,
      campusId: campus.id,
      classSectionId: classSection.id,
      studentId: student.id,
      status: EnrollmentStatus.ENROLLED,
    },
  })

  await ensureDefaultPolicies(organization.id)
  await ensureDefaultGradingScale(organization.id)
  await ensureDefaultPoliciesForCampus(
    { organizationId: organization.id, campusId: campus.id },
    prisma
  )
  await ensureDemoBoards({
    organizationId: organization.id,
    campusId: campus.id,
    classSectionId: classSection.id,
    adminId: schoolAdmin.id,
    instructorId: instructor.id,
  })

  console.log("Seed completed.")
  console.log(`Demo users use password: ${demoPassword}`)
}

async function upsertCampus(organizationId: string) {
  const existing = await prisma.campus.findFirst({
    where: { organizationId, code: "DEMO" },
  })

  if (existing) {
    return prisma.campus.update({
      where: { id: existing.id },
      data: { name: "Demo Campus", isActive: true },
    })
  }

  return prisma.campus.create({
    data: {
      organizationId,
      name: "Demo Campus",
      code: "DEMO",
    },
  })
}

async function upsertUser(
  organizationId: string,
  email: string,
  name: string,
  passwordHash: string
) {
  return prisma.user.upsert({
    where: {
      organizationId_email: {
        organizationId,
        email,
      },
    },
    update: {
      organizationId,
      email,
      name,
      passwordHash,
      isActive: true,
      username: null,
    },
    create: {
      organizationId,
      email,
      name,
      passwordHash,
      isActive: true,
    },
  })
}

async function ensureRole(
  organizationId: string,
  campusId: string | null,
  userId: string,
  role: UserRole
) {
  const existing = await prisma.userRoleAssignment.findFirst({
    where: { organizationId, userId, role },
  })

  if (existing) {
    return prisma.userRoleAssignment.update({
      where: { id: existing.id },
      data: {
        campusId,
        startsAt: null,
        endsAt: null,
      },
    })
  }

  return prisma.userRoleAssignment.create({
    data: {
      organizationId,
      campusId,
      userId,
      role,
    },
  })
}

async function findOrCreateAcademicYear(
  organizationId: string,
  campusId: string
) {
  const existing = await prisma.academicYear.findFirst({
    where: { organizationId, campusId, name: "2026" },
  })

  if (existing) return existing

  return prisma.academicYear.create({
    data: {
      organizationId,
      campusId,
      name: "2026",
      startsAt: new Date("2026-03-01T00:00:00.000Z"),
      endsAt: new Date("2027-02-28T23:59:59.000Z"),
      isActive: true,
    },
  })
}

async function findOrCreateTerm(
  organizationId: string,
  campusId: string,
  academicYearId: string
) {
  const existing = await prisma.term.findFirst({
    where: { organizationId, campusId, academicYearId, name: "2026 Spring" },
  })

  if (existing) return existing

  return prisma.term.create({
    data: {
      organizationId,
      campusId,
      academicYearId,
      name: "2026 Spring",
      startsAt: new Date("2026-03-01T00:00:00.000Z"),
      endsAt: new Date("2026-08-31T23:59:59.000Z"),
      sequence: 1,
      isActive: true,
    },
  })
}

async function findOrCreateGradeLevel(
  organizationId: string,
  campusId: string,
  academicYearId: string
) {
  const existing = await prisma.gradeLevel.findFirst({
    where: { organizationId, campusId, academicYearId, code: "G5" },
  })

  if (existing) return existing

  return prisma.gradeLevel.create({
    data: {
      organizationId,
      campusId,
      academicYearId,
      name: "Grade 5",
      code: "G5",
      sequence: 5,
    },
  })
}

async function findOrCreateHomeroom(
  organizationId: string,
  campusId: string,
  academicYearId: string,
  gradeLevelId: string,
  teacherId: string
) {
  const existing = await prisma.homeroom.findFirst({
    where: { organizationId, campusId, academicYearId, name: "Grade 5-A" },
  })

  if (existing) {
    return prisma.homeroom.update({
      where: { id: existing.id },
      data: { gradeLevelId, teacherId },
    })
  }

  return prisma.homeroom.create({
    data: {
      organizationId,
      campusId,
      academicYearId,
      gradeLevelId,
      teacherId,
      name: "Grade 5-A",
    },
  })
}

async function findOrCreateDepartment(
  organizationId: string,
  campusId: string
) {
  const existing = await prisma.department.findFirst({
    where: { organizationId, campusId, code: "CS" },
  })

  if (existing) return existing

  return prisma.department.create({
    data: {
      organizationId,
      campusId,
      name: "Computer Science",
      code: "CS",
    },
  })
}

async function findOrCreateCourse(
  organizationId: string,
  campusId: string,
  departmentId: string
) {
  const existing = await prisma.course.findFirst({
    where: { organizationId, campusId, code: "LMS-101" },
  })

  if (existing) return existing

  return prisma.course.create({
    data: {
      organizationId,
      campusId,
      departmentId,
      code: "LMS-101",
      title: "Introduction to Learning",
      description: "Demo course for local LMS development.",
      credits: "3.00",
      defaultDeliveryMode: DeliveryMode.HYBRID,
    },
  })
}

async function findOrCreateClassSection(input: {
  organizationId: string
  campusId: string
  academicYearId: string
  termId: string
  courseId: string
  gradeLevelId: string
  homeroomId: string
}) {
  const existing = await prisma.classSection.findFirst({
    where: {
      organizationId: input.organizationId,
      campusId: input.campusId,
      sectionCode: "LMS-101-A",
    },
  })

  if (existing) {
    return prisma.classSection.update({
      where: { id: existing.id },
      data: {
        academicYearId: input.academicYearId,
        termId: input.termId,
        courseId: input.courseId,
        gradeLevelId: input.gradeLevelId,
        homeroomId: input.homeroomId,
        deliveryMode: DeliveryMode.HYBRID,
      },
    })
  }

  return prisma.classSection.create({
    data: {
      organizationId: input.organizationId,
      campusId: input.campusId,
      academicYearId: input.academicYearId,
      termId: input.termId,
      courseId: input.courseId,
      gradeLevelId: input.gradeLevelId,
      homeroomId: input.homeroomId,
      name: "Introduction to Learning - Section A",
      sectionCode: "LMS-101-A",
      deliveryMode: DeliveryMode.HYBRID,
      capacity: 30,
    },
  })
}

async function ensureDefaultPolicies(organizationId: string) {
  await ensureDefaultPoliciesForOrganization({ organizationId }, prisma)
}

async function ensureDefaultGradingScale(organizationId: string) {
  await ensureDefaultGradingScaleForOrganization({ organizationId }, prisma)
}

async function ensureDemoBoards(input: {
  organizationId: string
  campusId: string
  classSectionId: string
  adminId: string
  instructorId: string
}) {
  const schoolBoard = await upsertBoard({
    organizationId: input.organizationId,
    campusId: input.campusId,
    classSectionId: null,
    name: "School Announcements",
    description: "Official campus-wide announcements for students and parents.",
    boardKind: "SCHOOL_ANNOUNCEMENTS",
    allowStudentPosts: false,
    allowParentPosts: false,
    allowComments: false,
  })
  const classAnnouncements = await upsertBoard({
    organizationId: input.organizationId,
    campusId: input.campusId,
    classSectionId: input.classSectionId,
    name: "Introduction to Learning - Announcements",
    description: "Instructor announcements for this class section.",
    boardKind: "CLASS_ANNOUNCEMENTS",
    allowStudentPosts: false,
    allowParentPosts: false,
    allowComments: true,
  })
  const qaBoard = await upsertBoard({
    organizationId: input.organizationId,
    campusId: input.campusId,
    classSectionId: input.classSectionId,
    name: "Introduction to Learning - Q&A",
    description: "Students can ask class questions here.",
    boardKind: "CLASS_QA",
    allowStudentPosts: true,
    allowParentPosts: false,
    allowComments: true,
  })
  await upsertBoard({
    organizationId: input.organizationId,
    campusId: input.campusId,
    classSectionId: input.classSectionId,
    name: "Introduction to Learning - Resources",
    description: "Resources and reference links for this class.",
    boardKind: "CLASS_RESOURCES",
    allowStudentPosts: false,
    allowParentPosts: false,
    allowComments: true,
  })

  await upsertPost({
    organizationId: input.organizationId,
    boardId: schoolBoard.id,
    authorId: input.adminId,
    title: "Welcome to Demo Education Organization",
    body: "Welcome to the LMS demo. School-wide announcements will appear here.",
    isPinned: true,
  })
  await upsertPost({
    organizationId: input.organizationId,
    boardId: classAnnouncements.id,
    authorId: input.instructorId,
    title: "Welcome to Introduction to Learning",
    body: "This board is where class announcements will be posted.",
    isPinned: true,
  })
  await upsertPost({
    organizationId: input.organizationId,
    boardId: qaBoard.id,
    authorId: input.instructorId,
    title: "Class Q&A is open",
    body: "Use this board to ask questions about lessons, assignments, and quizzes.",
    isPinned: true,
  })
}

async function upsertBoard(input: {
  organizationId: string
  campusId: string | null
  classSectionId: string | null
  name: string
  description: string
  boardKind: BoardKind
  allowStudentPosts: boolean
  allowParentPosts: boolean
  allowComments: boolean
}) {
  const existing = await prisma.board.findFirst({
    where: {
      organizationId: input.organizationId,
      classSectionId: input.classSectionId,
      name: input.name,
    },
  })
  const data = {
    campusId: input.campusId,
    classSectionId: input.classSectionId,
    description: input.description,
    isActive: true,
    name: input.name,
    scopeType: getBoardScopeTypeForKind(
      input.boardKind,
      Boolean(input.classSectionId)
    ) as BoardScopeType,
    settings: {
      boardKind: input.boardKind,
      allowStudentPosts: input.allowStudentPosts,
      allowParentPosts: input.allowParentPosts,
      allowComments: input.allowComments,
    },
    type: getBoardTypeForKind(input.boardKind) as BoardType,
  }

  if (existing) {
    return prisma.board.update({
      where: { id: existing.id },
      data,
    })
  }

  return prisma.board.create({
    data: {
      organizationId: input.organizationId,
      ...data,
    },
  })
}

async function upsertPost(input: {
  organizationId: string
  boardId: string
  authorId: string
  title: string
  body: string
  isPinned: boolean
}) {
  const existing = await prisma.post.findFirst({
    where: {
      boardId: input.boardId,
      title: input.title,
    },
  })
  const data = {
    authorId: input.authorId,
    body: input.body,
    isPinned: input.isPinned,
    publishedAt: new Date(),
  }

  if (existing) {
    await prisma.post.update({
      where: { id: existing.id },
      data,
    })
  } else {
    await prisma.post.create({
      data: {
        organizationId: input.organizationId,
        boardId: input.boardId,
        title: input.title,
        ...data,
      },
    })
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
