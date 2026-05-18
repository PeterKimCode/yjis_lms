import { PrismaPg } from "@prisma/adapter-pg"
import bcrypt from "bcryptjs"

import {
  DeliveryMode,
  EnrollmentStatus,
  InstitutionType,
  PrismaClient,
  UserRole,
} from "@prisma/client"

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
  const academicPolicy = await prisma.academicPolicy.findFirst({
    where: { organizationId, name: "Default Academic Policy" },
  })
  const academicPolicyData = {
    campusId: null,
    classSectionId: null,
    settings: {
      academicCalendar: "semester",
      supportsK12ReportCards: true,
      supportsUniversityTranscripts: true,
    },
  }

  if (academicPolicy) {
    await prisma.academicPolicy.update({
      where: { id: academicPolicy.id },
      data: academicPolicyData,
    })
  } else {
    await prisma.academicPolicy.create({
      data: {
        organizationId,
        name: "Default Academic Policy",
        ...academicPolicyData,
      },
    })
  }

  const attendancePolicy = await prisma.attendancePolicy.findFirst({
    where: { organizationId, name: "Default Attendance Policy" },
  })
  const attendancePolicyData = {
    campusId: null,
    classSectionId: null,
    lateAfterMinutes: 10,
    absenceAfterMinutes: 30,
    settings: {
      lateThresholdMinutes: 10,
      absenceFailThresholdRate: null,
      countLateAsAbsence: false,
      lateEquivalentAbsenceCount: 0,
      excusedCountsAsPresent: false,
      excusedCountsAgainstAttendance: false,
      allowInstructorOverride: true,
      allowInstructorEdits: true,
      requireAbsenceReason: true,
    },
  }

  if (attendancePolicy) {
    await prisma.attendancePolicy.update({
      where: { id: attendancePolicy.id },
      data: attendancePolicyData,
    })
  } else {
    await prisma.attendancePolicy.create({
      data: {
        organizationId,
        name: "Default Attendance Policy",
        ...attendancePolicyData,
      },
    })
  }

  const videoPolicy = await prisma.videoCompletionPolicy.findFirst({
    where: { organizationId, name: "Default Video Completion Policy" },
  })
  const videoPolicyData = {
    campusId: null,
    classSectionId: null,
    requiredPercentage: "90.00",
    settings: {
      completionRate: 90,
      completionThresholdPercent: 90,
      minimumWatchSeconds: null,
      requireActualWatchedCoverage: true,
    },
  }

  if (videoPolicy) {
    await prisma.videoCompletionPolicy.update({
      where: { id: videoPolicy.id },
      data: videoPolicyData,
    })
  } else {
    await prisma.videoCompletionPolicy.create({
      data: {
        organizationId,
        name: "Default Video Completion Policy",
        ...videoPolicyData,
      },
    })
  }

  const gradingPolicy = await prisma.gradingPolicy.findFirst({
    where: { organizationId, name: "Default Grading Policy" },
  })
  const gradingPolicyData = {
    campusId: null,
    classSectionId: null,
    gpaScale: "4.50",
    settings: {
      allowLateSubmissionDefault: false,
      allowResubmissionBeforeDue: true,
      latePenaltyPercent: 0,
      maxLateDays: null,
      studentsCanSeeDraftGrades: false,
      parentsCanSeeDraftGrades: false,
      showAssignmentFeedbackBeforeFinalGrade: true,
      showQuizResultsImmediately: true,
      reportCardsRequirePublishedGrades: true,
      transcriptsRequirePublishedGrades: true,
      rounding: "half-up",
      publishFinalGradesAfterReview: true,
    },
  }

  if (gradingPolicy) {
    await prisma.gradingPolicy.update({
      where: { id: gradingPolicy.id },
      data: gradingPolicyData,
    })
  } else {
    await prisma.gradingPolicy.create({
      data: {
        organizationId,
        name: "Default Grading Policy",
        ...gradingPolicyData,
      },
    })
  }

  const messagingPolicy = await prisma.messagingPolicy.findFirst({
    where: { organizationId, name: "Default Messaging Policy" },
  })
  const messagingPolicyData = {
    allowStudentDirectMessages: false,
    settings: {
      allowParentInstructorMessages: true,
      retainMessages: true,
    },
  }

  if (messagingPolicy) {
    await prisma.messagingPolicy.update({
      where: { id: messagingPolicy.id },
      data: messagingPolicyData,
    })
  } else {
    await prisma.messagingPolicy.create({
      data: {
      organizationId,
        name: "Default Messaging Policy",
        ...messagingPolicyData,
      },
    })
  }
}

async function ensureDefaultGradingScale(organizationId: string) {
  const scaleName = "Default A-F Grading Scale"
  const existing = await prisma.gradingScale.findFirst({
    where: { organizationId, name: scaleName },
  })

  const gradingScale =
    existing ??
    (await prisma.gradingScale.create({
      data: {
        organizationId,
        name: scaleName,
        description: "Default local development grading scale.",
        isDefault: true,
      },
    }))

  await prisma.gradingScale.update({
    where: { id: gradingScale.id },
    data: {
      description: "Default local development grading scale.",
      isDefault: true,
    },
  })

  await prisma.gradingScaleItem.deleteMany({
    where: { gradingScaleId: gradingScale.id },
  })

  await prisma.gradingScaleItem.createMany({
    data: [
      gradeBand(gradingScale.id, "A+", "95.00", "100.00", "4.50", true),
      gradeBand(gradingScale.id, "A", "90.00", "94.99", "4.00", true),
      gradeBand(gradingScale.id, "B+", "85.00", "89.99", "3.50", true),
      gradeBand(gradingScale.id, "B", "80.00", "84.99", "3.00", true),
      gradeBand(gradingScale.id, "C+", "75.00", "79.99", "2.50", true),
      gradeBand(gradingScale.id, "C", "70.00", "74.99", "2.00", true),
      gradeBand(gradingScale.id, "D", "60.00", "69.99", "1.00", true),
      gradeBand(gradingScale.id, "F", "0.00", "59.99", "0.00", false),
    ],
  })
}

function gradeBand(
  gradingScaleId: string,
  label: string,
  minPercentage: string,
  maxPercentage: string,
  gradePoint: string,
  isPassing: boolean
) {
  return {
    gradingScaleId,
    label,
    minPercentage,
    maxPercentage,
    gradePoint,
    isPassing,
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
