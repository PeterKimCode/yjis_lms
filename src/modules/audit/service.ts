import "server-only"

import type { Prisma } from "@prisma/client"

import { getPrismaClient } from "@/lib/prisma"

type AuditInput = {
  action: string
  actorUserId?: string | null
  campusId?: string | null
  entityId?: string | null
  entityType: string
  metadata?: Prisma.InputJsonObject
  organizationId: string
  summary?: string | null
}

export async function writeAuditLog(input: AuditInput) {
  try {
    await getPrismaClient().auditLog.create({
      data: {
        action: input.action,
        actorUserId: input.actorUserId ?? null,
        campusId: input.campusId ?? null,
        entityId: input.entityId ?? null,
        entityType: input.entityType,
        metadata: input.metadata,
        organizationId: input.organizationId,
        summary: input.summary ?? null,
      },
    })
  } catch (error) {
    console.error("Audit log write failed", {
      action: input.action,
      entityId: input.entityId,
      entityType: input.entityType,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
