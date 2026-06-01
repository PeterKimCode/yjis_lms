import { NextResponse } from "next/server"
import { UserRole } from "@prisma/client"
import { revalidatePath } from "next/cache"

import { requireAnyRole } from "@/modules/auth/permissions"
import {
  LessonFileUploadError,
  uploadLessonAttachmentFile,
} from "@/modules/learning/file-upload-service"

export async function POST(request: Request) {
  const instructor = await requireAnyRole([
    UserRole.INSTRUCTOR,
    UserRole.HOMEROOM_TEACHER,
  ])
  const formData = await request.formData()
  const classSectionId = String(formData.get("classSectionId") ?? "")
  const file = formData.get("lessonFile")

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Choose a lesson file to upload." },
      { status: 400 }
    )
  }

  try {
    const fileAsset = await uploadLessonAttachmentFile({
      classSectionId,
      file,
      instructorId: instructor.id,
    })

    revalidatePath(`/instructor/classes/${classSectionId}`)

    return NextResponse.json({
      ok: true,
      message: "Lesson file uploaded. You can now select it.",
      fileAsset: {
        id: fileAsset.id,
        label: fileAsset.originalName,
      },
    })
  } catch (error) {
    if (error instanceof LessonFileUploadError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      )
    }

    console.error("Lesson file upload failed", {
      classSectionId,
      error: error instanceof Error ? error.message : String(error),
    })

    return NextResponse.json(
      { error: "Lesson file upload failed. Please try again." },
      { status: 500 }
    )
  }
}
