import "dotenv/config"

import { setTimeout as sleep } from "node:timers/promises"
import { PrismaPg } from "@prisma/adapter-pg"
import {
  NotificationChannel,
  NotificationType,
  PrismaClient,
} from "@prisma/client"

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to run the background worker.")
}

const adapter = new PrismaPg({ connectionString: databaseUrl })
const prisma = new PrismaClient({ adapter })
const once = process.argv.includes("--once")
const intervalMs = readPositiveInteger("WORKER_POLL_INTERVAL_MS", 60_000)
const assignmentLookaheadHours = readPositiveInteger(
  "WORKER_ASSIGNMENT_DUE_LOOKAHEAD_HOURS",
  24
)
let shuttingDown = false

type WorkerJob = {
  name: string
  run: () => Promise<void>
}

const jobs: WorkerJob[] = [
  {
    name: "assignment-due-soon-notifications",
    run: sendAssignmentDueSoonNotifications,
  },
  {
    name: "quiz-open-notifications",
    run: sendQuizOpenedNotifications,
  },
]

process.on("SIGINT", () => {
  shuttingDown = true
})

process.on("SIGTERM", () => {
  shuttingDown = true
})

main().catch(async (error) => {
  logError("Worker crashed", error)
  await prisma.$disconnect()
  process.exit(1)
})

async function main() {
  logInfo(
    once
      ? "Starting LMS background worker in one-shot mode."
      : `Starting LMS background worker. Poll interval: ${intervalMs}ms.`
  )

  do {
    await runJobs()
    if (once) break
    await sleep(intervalMs)
  } while (!shuttingDown)

  await prisma.$disconnect()
  logInfo("LMS background worker stopped.")
}

async function runJobs() {
  for (const job of jobs) {
    const startedAt = Date.now()
    try {
      await job.run()
      logInfo(`${job.name} completed in ${Date.now() - startedAt}ms.`)
    } catch (error) {
      logError(`${job.name} failed`, error)
    }
  }
}

async function sendAssignmentDueSoonNotifications() {
  const now = new Date()
  const dueBefore = new Date(
    now.getTime() + assignmentLookaheadHours * 60 * 60 * 1000
  )
  const assignments = await prisma.assignment.findMany({
    where: {
      dueAt: {
        gt: now,
        lte: dueBefore,
      },
    },
    select: {
      id: true,
      classSectionId: true,
      dueAt: true,
      organizationId: true,
      title: true,
      classSection: {
        select: {
          enrollments: {
            select: {
              student: {
                select: {
                  id: true,
                  isActive: true,
                  notificationPreferences: {
                    where: {
                      channel: NotificationChannel.IN_APP,
                      type: NotificationType.ASSIGNMENT_DUE,
                    },
                    select: { enabled: true },
                  },
                },
              },
            },
          },
        },
      },
    },
    take: 100,
  })

  for (const assignment of assignments) {
    for (const enrollment of assignment.classSection.enrollments) {
      const student = enrollment.student
      if (!student.isActive || !isPreferenceEnabled(student.notificationPreferences)) {
        continue
      }

      await createNotificationIfMissing({
        actionUrl: `/student/classes/${assignment.classSectionId}`,
        body: assignment.dueAt
          ? `Due ${assignment.dueAt.toLocaleString("en")}`
          : null,
        entityId: assignment.id,
        entityType: "Assignment",
        organizationId: assignment.organizationId,
        title: `Assignment due soon: ${assignment.title}`,
        type: NotificationType.ASSIGNMENT_DUE,
        userId: student.id,
      })
    }
  }
}

async function sendQuizOpenedNotifications() {
  const now = new Date()
  const openedAfter = new Date(now.getTime() - intervalMs * 2)
  const quizzes = await prisma.quiz.findMany({
    where: {
      isPublished: true,
      opensAt: {
        gt: openedAfter,
        lte: now,
      },
    },
    select: {
      id: true,
      classSectionId: true,
      organizationId: true,
      title: true,
      classSection: {
        select: {
          enrollments: {
            select: {
              student: {
                select: {
                  id: true,
                  isActive: true,
                  notificationPreferences: {
                    where: {
                      channel: NotificationChannel.IN_APP,
                      type: NotificationType.QUIZ_OPENED,
                    },
                    select: { enabled: true },
                  },
                },
              },
            },
          },
        },
      },
    },
    take: 100,
  })

  for (const quiz of quizzes) {
    for (const enrollment of quiz.classSection.enrollments) {
      const student = enrollment.student
      if (!student.isActive || !isPreferenceEnabled(student.notificationPreferences)) {
        continue
      }

      await createNotificationIfMissing({
        actionUrl: `/student/classes/${quiz.classSectionId}`,
        body: "The quiz is now open.",
        entityId: quiz.id,
        entityType: "Quiz",
        organizationId: quiz.organizationId,
        title: `Quiz opened: ${quiz.title}`,
        type: NotificationType.QUIZ_OPENED,
        userId: student.id,
      })
    }
  }
}

async function createNotificationIfMissing({
  actionUrl,
  body,
  entityId,
  entityType,
  organizationId,
  title,
  type,
  userId,
}: {
  actionUrl: string
  body: string | null
  entityId: string
  entityType: string
  organizationId: string
  title: string
  type: NotificationType
  userId: string
}) {
  const existing = await prisma.notification.findFirst({
    where: {
      channel: NotificationChannel.IN_APP,
      entityId,
      entityType,
      type,
      userId,
    },
    select: { id: true },
  })

  if (existing) return

  await prisma.notification.create({
    data: {
      actionUrl,
      body,
      channel: NotificationChannel.IN_APP,
      entityId,
      entityType,
      organizationId,
      title,
      type,
      userId,
    },
  })
}

function isPreferenceEnabled(preferences: Array<{ enabled: boolean }>) {
  return preferences[0]?.enabled ?? true
}

function readPositiveInteger(name: string, fallback: number) {
  const value = Number(process.env[name])
  return Number.isInteger(value) && value > 0 ? value : fallback
}

function logInfo(message: string) {
  console.log(`[worker] ${new Date().toISOString()} ${message}`)
}

function logError(message: string, error: unknown) {
  console.error(`[worker] ${new Date().toISOString()} ${message}`, {
    error: error instanceof Error ? error.message : String(error),
  })
}
