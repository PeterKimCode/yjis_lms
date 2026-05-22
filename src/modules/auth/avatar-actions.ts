"use server"

import { revalidatePath } from "next/cache"

import { getPrismaClient } from "@/lib/prisma"
import { requireAuth } from "@/modules/auth/permissions"
import { uploadImageFile } from "@/modules/files/upload"

export type AvatarUploadState = {
  message: string
  ok: boolean
}

export async function updateCurrentUserAvatar(
  _state: AvatarUploadState,
  formData: FormData
): Promise<AvatarUploadState> {
  const authUser = await requireAuth()
  const file = formData.get("avatar")

  if (!(file instanceof File) || file.size === 0) {
    return {
      ok: false,
      message: "Choose a JPG, PNG, WEBP, or GIF image first.",
    }
  }

  const user = await getPrismaClient().user.findUnique({
    where: { id: authUser.id },
    select: {
      id: true,
      organizationId: true,
      roleAssignments: {
        select: { campusId: true },
        take: 1,
      },
    },
  })

  if (!user) {
    return { ok: false, message: "User account was not found." }
  }

  try {
    const upload = await uploadImageFile({
      campusId: user.roleAssignments[0]?.campusId ?? null,
      file,
      metadata: { source: "user-avatar" },
      organizationId: user.organizationId,
      ownerId: user.id,
      prefix: `users/${user.id}/avatar`,
    })

    if (!upload.ok) {
      return { ok: false, message: upload.message }
    }

    await getPrismaClient().user.update({
      where: { id: user.id },
      data: { avatarFileAssetId: upload.fileAsset.id },
    })

    revalidatePath("/")
    revalidatePath("/messages")
    revalidatePath("/notifications")

    return { ok: true, message: "Profile photo updated." }
  } catch (error) {
    console.error("Avatar upload failed", {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    })

    return {
      ok: false,
      message: "Image upload failed. Please try again.",
    }
  }
}
