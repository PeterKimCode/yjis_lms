import { UserRole } from "@prisma/client"
import { notFound } from "next/navigation"

import { EmptyState, SectionBlock } from "@/modules/dashboards/components"
import { getPublishedLessonForStudent } from "@/modules/dashboards/data"
import { requireAnyRole } from "@/modules/auth/permissions"
import { VideoProgressPlayer } from "@/modules/learning/video-progress-player"

export default async function StudentLessonPage({
  params,
}: {
  params: Promise<{ classSectionId: string; lessonId: string }>
}) {
  const user = await requireAnyRole([UserRole.STUDENT])
  const { classSectionId, lessonId } = await params
  const lesson = await getPublishedLessonForStudent({
    studentId: user.id,
    classSectionId,
    lessonId,
  })

  if (!lesson) {
    notFound()
  }

  const progress = lesson.videoProgress[0]

  return (
    <main className="flex-1 bg-muted/40 px-4 py-8">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            {lesson.classSection.course.title} - {lesson.classSection.name}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {lesson.title}
          </h1>
          {lesson.description ? (
            <p className="text-sm text-muted-foreground">{lesson.description}</p>
          ) : null}
        </div>

        <SectionBlock title="Lesson video">
          {lesson.videoUrl ? (
            <VideoProgressPlayer
              classSectionId={classSectionId}
              durationSeconds={lesson.durationSeconds}
              initialCompleted={progress?.completed ?? false}
              initialLastPositionSeconds={progress?.lastPositionSeconds ?? 0}
              initialProgressRate={Number(progress?.progressRate ?? 0)}
              lessonId={lesson.id}
              videoUrl={lesson.videoUrl}
            />
          ) : lesson.videoFileAsset ? (
            <EmptyState>
              Video file metadata exists, but playback from local MinIO is not
              configured yet.
            </EmptyState>
          ) : (
            <EmptyState>No video has been attached to this lesson yet.</EmptyState>
          )}
        </SectionBlock>
      </div>
    </main>
  )
}
