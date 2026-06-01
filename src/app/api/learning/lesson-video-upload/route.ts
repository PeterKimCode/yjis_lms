import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"
import { UserRole } from "@prisma/client"

import { requireAnyRole } from "@/modules/auth/permissions"
import {
  LessonVideoUploadError,
  uploadLessonVideoFile,
} from "@/modules/learning/video-upload-service"

export async function POST(request: Request) {
  const instructor = await requireAnyRole([
    UserRole.INSTRUCTOR,
    UserRole.HOMEROOM_TEACHER,
  ])
  const formData = await request.formData()
  const classSectionId = String(formData.get("classSectionId") ?? "")
  const file = formData.get("videoFile")

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Choose a video file to upload." },
      { status: 400 }
    )
  }

  try {
    const fileAsset = await uploadLessonVideoFile({
      classSectionId,
      file,
      instructorId: instructor.id,
    })

    revalidatePath(`/instructor/classes/${classSectionId}`)

    return NextResponse.json({
      ok: true,
      message: "Video uploaded. You can now select it from Uploaded video file.",
      fileAsset: {
        id: fileAsset.id,
        label: fileAsset.originalName,
      },
    })
  } catch (error) {
    if (error instanceof LessonVideoUploadError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }

    console.error("Lesson video upload failed", {
      classSectionId,
      error: error instanceof Error ? error.message : String(error),
    })

    return NextResponse.json(
      { error: "Video upload failed. Please try again." },
      { status: 500 }
    )
  }
}
