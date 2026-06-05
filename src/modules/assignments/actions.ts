"use server"

import { revalidatePath } from "next/cache"
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { FileVisibility, NotificationType, Prisma, UserRole } from "@prisma/client"
import { z } from "zod"

import { getPrismaClient } from "@/lib/prisma"
import {
  canManageClassSection,
  canViewClassSection,
  requireAnyRole,
} from "@/modules/auth/permissions"
import type { AssignmentActionState } from "@/modules/assignments/action-state"
import { validateAssignmentAttachment } from "@/modules/files/upload-validation"
import {
  createNotification,
  notifyClassInstructors,
  notifyClassStudents,
  notifyLinkedParentsForStudent,
} from "@/modules/notifications/service"

const optionalString = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() : ""),
  z.string().transform((value) => (value.length ? value : null))
)
const requiredString = z.string().trim().min(1)
const optionalDate = optionalString.transform((value) =>
  value ? new Date(value) : null
)

const assignmentSchema = z.object({
  id: optionalString,
  classSectionId: requiredString,
  title: requiredString,
  description: optionalString,
  dueAt: optionalDate,
  pointsPossible: z.coerce.number().positive("Max score must be greater than 0."),
  acceptsLate: z.boolean(),
})

export async function saveAssignment(
  _previousState: AssignmentActionState,
  formData: FormData
): Promise<AssignmentActionState> {
  const parsed = assignmentSchema.safeParse({
    id: formData.get("id") ?? "",
    classSectionId: formData.get("classSectionId") ?? "",
    title: formData.get("title") ?? "",
    description: formData.get("description") ?? "",
    dueAt: formData.get("dueAt") ?? "",
    pointsPossible: formData.get("pointsPossible") ?? "",
    acceptsLate: formData.get("acceptsLate") === "on",
  })

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check the assignment form.",
    }
  }

  const user = await requireAnyRole([
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.SCHOOL_ADMIN,
    UserRole.ACADEMIC_STAFF,
    UserRole.INSTRUCTOR,
    UserRole.HOMEROOM_TEACHER,
  ])
  const data = parsed.data

  if (!(await canManageClassSection(user.id, data.classSectionId))) {
    return {
      ok: false,
      message: "You do not have permission to manage assignments for this class.",
    }
  }

  const prisma = getPrismaClient()
  const classSection = await prisma.classSection.findUnique({
    where: { id: data.classSectionId },
    select: { organizationId: true },
  })
  if (!classSection) {
    return { ok: false, message: "Class section was not found." }
  }
  const { id, ...values } = data

  if (id) {
    const assignment = await prisma.assignment.findUnique({
      where: { id },
      select: { classSectionId: true },
    })

    if (!assignment || assignment.classSectionId !== data.classSectionId) {
      return {
        ok: false,
        message: "Assignment does not belong to this class section.",
      }
    }

    await prisma.assignment.update({
      where: { id },
      data: {
        ...values,
        pointsPossible: new Prisma.Decimal(values.pointsPossible),
      },
    })
  } else {
    const assignment = await prisma.assignment.create({
      data: {
        ...values,
        organizationId: classSection.organizationId,
        pointsPossible: new Prisma.Decimal(values.pointsPossible),
      },
    })
    await notifyClassStudents(data.classSectionId, {
      actionUrl: `/student/classes/${data.classSectionId}`,
      actorUserId: user.id,
      body: data.description ?? undefined,
      entityId: assignment.id,
      entityType: "Assignment",
      title: `New assignment: ${data.title}`,
      type: NotificationType.NEW_ASSIGNMENT,
    })
  }

  revalidatePath(`/instructor/classes/${data.classSectionId}`)
  revalidatePath(`/student/classes/${data.classSectionId}`)
  return { ok: true, message: id ? "Assignment saved." : "Assignment created." }
}

export async function deleteAssignment(
  _previousState: AssignmentActionState,
  formData: FormData
): Promise<AssignmentActionState> {
  const user = await requireAnyRole([
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.SCHOOL_ADMIN,
    UserRole.ACADEMIC_STAFF,
    UserRole.INSTRUCTOR,
    UserRole.HOMEROOM_TEACHER,
  ])
  const assignmentId = String(formData.get("assignmentId") ?? "")
  const assignment = await getPrismaClient().assignment.findUnique({
    where: { id: assignmentId },
    include: { _count: { select: { submissions: true } } },
  })

  if (!assignment) {
    return { ok: false, message: "Assignment was not found." }
  }

  if (!(await canManageClassSection(user.id, assignment.classSectionId))) {
    return {
      ok: false,
      message: "You do not have permission to delete this assignment.",
    }
  }

  if (assignment._count.submissions > 0) {
    return {
      ok: false,
      message: "Assignments with submissions cannot be deleted.",
    }
  }

  await getPrismaClient().assignment.delete({ where: { id: assignment.id } })
  revalidatePath(`/instructor/classes/${assignment.classSectionId}`)
  return { ok: true, message: "Assignment deleted." }
}

const submissionSchema = z.object({
  assignmentId: requiredString,
  content: requiredString,
})

export async function submitAssignment(
  _previousState: AssignmentActionState,
  formData: FormData
): Promise<AssignmentActionState> {
  const student = await requireAnyRole([UserRole.STUDENT])
  const parsed = submissionSchema.safeParse({
    assignmentId: formData.get("assignmentId") ?? "",
    content: formData.get("content") ?? "",
  })
  const file = formData.get("attachmentFile")

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Enter a response.",
    }
  }

  const prisma = getPrismaClient()
  const assignment = await prisma.assignment.findUnique({
    where: { id: parsed.data.assignmentId },
    select: {
      id: true,
      organizationId: true,
      classSectionId: true,
      title: true,
      dueAt: true,
      acceptsLate: true,
    },
  })
  if (!assignment) {
    return { ok: false, message: "Assignment was not found." }
  }

  if (!(await canViewClassSection(student.id, assignment.classSectionId))) {
    return {
      ok: false,
      message: "You do not have permission to submit this assignment.",
    }
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: {
      classSectionId_studentId: {
        classSectionId: assignment.classSectionId,
        studentId: student.id,
      },
    },
    select: { id: true },
  })

  if (!enrollment) {
    return {
      ok: false,
      message: "Only enrolled students can submit assignments.",
    }
  }

  if (
    assignment.dueAt &&
    assignment.dueAt.getTime() < Date.now() &&
    !assignment.acceptsLate
  ) {
    return {
      ok: false,
      message: "This assignment is closed for submissions.",
    }
  }

  if (file instanceof File && file.size > 0) {
    const validatedFile = validateAssignmentAttachment(file)

    if (!validatedFile.ok) {
      return { ok: false, message: validatedFile.message }
    }
  }

  const submission = await prisma.assignmentSubmission.upsert({
    where: {
      assignmentId_studentId: {
        assignmentId: assignment.id,
        studentId: student.id,
      },
    },
    update: {
      content: parsed.data.content,
      submittedAt: new Date(),
    },
    create: {
      organizationId: assignment.organizationId,
      assignmentId: assignment.id,
      studentId: student.id,
      content: parsed.data.content,
      submittedAt: new Date(),
    },
  })

  if (file instanceof File && file.size > 0) {
    const upload = validateAssignmentAttachment(file)

    if (!upload.ok) {
      return { ok: false, message: upload.message }
    }

    const bucket = process.env.S3_BUCKET_NAME ?? "lms-files"
    const objectKey = [
      "assignments",
      assignment.organizationId,
      assignment.classSectionId,
      assignment.id,
      student.id,
      `${crypto.randomUUID()}-${upload.safeName}`,
    ].join("/")

    await createS3Client().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        Body: Buffer.from(await file.arrayBuffer()),
        ContentType: upload.contentType,
      })
    )

    await prisma.fileAsset.updateMany({
      where: { assignmentSubmissionId: submission.id },
      data: { assignmentSubmissionId: null },
    })

    await prisma.fileAsset.create({
      data: {
        organizationId: assignment.organizationId,
        classSectionId: assignment.classSectionId,
        uploadedById: student.id,
        bucket,
        objectKey,
        originalName: upload.safeName,
        contentType: upload.contentType,
        byteSize: BigInt(file.size),
        visibility: FileVisibility.CLASS_SECTION,
        assignmentSubmissionId: submission.id,
        metadata: {
          source: "assignment-submission",
          assignmentId: assignment.id,
        },
      },
    })
  }

  await notifyClassInstructors(assignment.classSectionId, {
    actionUrl: `/instructor/classes/${assignment.classSectionId}`,
    actorUserId: student.id,
    body: parsed.data.content,
    entityId: submission.id,
    entityType: "AssignmentSubmission",
    title: `${student.name ?? student.email ?? "A student"} submitted ${assignment.title}`,
    type: NotificationType.ASSIGNMENT_SUBMITTED,
  })

  revalidatePath(`/student/classes/${assignment.classSectionId}`)
  revalidatePath(`/instructor/classes/${assignment.classSectionId}`)
  return { ok: true, message: "Submission saved." }
}

const gradeSchema = z.object({
  submissionId: requiredString,
  score: z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    z.coerce.number({ error: "Score is required." }).min(0)
  ),
  feedback: optionalString,
})

export async function gradeSubmission(
  _previousState: AssignmentActionState,
  formData: FormData
): Promise<AssignmentActionState> {
  const instructor = await requireAnyRole([
    UserRole.SUPER_ADMIN,
    UserRole.ORG_ADMIN,
    UserRole.SCHOOL_ADMIN,
    UserRole.ACADEMIC_STAFF,
    UserRole.INSTRUCTOR,
    UserRole.HOMEROOM_TEACHER,
  ])
  const parsed = gradeSchema.safeParse({
    submissionId: formData.get("submissionId") ?? "",
    score: formData.get("score") ?? "",
    feedback: formData.get("feedback") ?? "",
  })

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check the grading form.",
    }
  }

  const prisma = getPrismaClient()
  const submission = await prisma.assignmentSubmission.findUnique({
    where: { id: parsed.data.submissionId },
    include: {
      assignment: {
        select: {
          classSectionId: true,
          pointsPossible: true,
          title: true,
        },
      },
    },
  })
  if (!submission) {
    return { ok: false, message: "Submission was not found." }
  }

  if (!(await canManageClassSection(instructor.id, submission.assignment.classSectionId))) {
    return {
      ok: false,
      message: "You do not have permission to grade this submission.",
    }
  }

  const maxScore = Number(submission.assignment.pointsPossible ?? 0)
  if (parsed.data.score > maxScore) {
    return {
      ok: false,
      message: `Score must be ${maxScore} or less.`,
    }
  }

  await prisma.assignmentSubmission.update({
    where: { id: submission.id },
    data: {
      score: new Prisma.Decimal(parsed.data.score),
      feedback: parsed.data.feedback,
      gradedById: instructor.id,
      gradedAt: new Date(),
    },
  })

  await Promise.all([
    createNotification({
      actionUrl: `/student/classes/${submission.assignment.classSectionId}`,
      actorUserId: instructor.id,
      entityId: submission.id,
      entityType: "AssignmentSubmission",
      title: `Assignment graded: ${submission.assignment.title}`,
      type: NotificationType.ASSIGNMENT_GRADED,
      userId: submission.studentId,
    }),
    notifyLinkedParentsForStudent(submission.studentId, {
      actionUrl: `/parent/students/${submission.studentId}`,
      actorUserId: instructor.id,
      entityId: submission.id,
      entityType: "AssignmentSubmission",
      title: `Assignment graded: ${submission.assignment.title}`,
      type: NotificationType.ASSIGNMENT_GRADED,
    }),
  ])

  revalidatePath(`/instructor/classes/${submission.assignment.classSectionId}`)
  revalidatePath(`/student/classes/${submission.assignment.classSectionId}`)
  return { ok: true, message: "Submission graded." }
}

function createS3Client() {
  return new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION ?? "us-east-1",
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
    },
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
  })
}
