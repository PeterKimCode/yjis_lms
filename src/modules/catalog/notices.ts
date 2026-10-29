"use server"
import { UserRole } from "@prisma/client"
import { revalidatePath } from "next/cache"
import { getPrismaClient } from "@/lib/prisma"
import { requireAnyRole } from "@/modules/auth/permissions"
import { canPublishNotice } from "./rules"
import type { CatalogState } from "./actions"
export async function saveLoginNotice(_: CatalogState, form: FormData): Promise<CatalogState> {
  const user = await requireAnyRole([UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN])
  const organizationId = String(form.get("organizationId") ?? "")
  if (!canPublishNotice(user.roleAssignments, organizationId)) return { ok: false, message: "You cannot manage this organization's notices." }
  try {
    const prisma = getPrismaClient(), id = String(form.get("id") ?? "")
    const title = String(form.get("title") ?? "").trim(), body = String(form.get("body") ?? "").trim()
    if (!title || title.length > 180 || !body || body.length > 10000) return { ok: false, message: "Enter a title (up to 180 characters) and notice (up to 10000 characters)." }
    await prisma.$transaction(async tx => {
      const values = { title, body, startsAt: null, endsAt: null, isPublished: form.get("isPublished") === "on" }
      const notice = id ? await tx.loginNotice.update({ where: { id, organizationId }, data: values }) : await tx.loginNotice.create({ data: { ...values, organizationId } })
      await tx.auditLog.create({ data: { organizationId, actorUserId: user.id, action: "login_notice.save", entityType: "LoginNotice", entityId: notice.id } })
    })
    revalidatePath("/login"); revalidatePath("/admin/login-notices")
    return { ok: true, message: "Notice saved. Published notices appear on the login page." }
  } catch { return { ok: false, message: "Could not save. Check the organization and retry." } }
}
