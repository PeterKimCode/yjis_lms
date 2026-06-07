import { UserRole, VideoProvider } from "@prisma/client"
import { notFound } from "next/navigation"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { EmptyState, SectionBlock } from "@/modules/dashboards/components"
import { getPublishedLessonForStudent } from "@/modules/dashboards/data"
import { requireAnyRole } from "@/modules/auth/permissions"
import { markLessonViewed } from "@/modules/learning/actions"
import { VideoProgressPlayer } from "@/modules/learning/video-progress-player"
import { YouTubePlayer } from "@/modules/learning/youtube-player"
import { parseYouTubeVideoId } from "@/modules/learning/video"

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

  if (lesson.contentType !== "VIDEO") {
    await markLessonViewed({ classSectionId, lessonId: lesson.id })
  }

  const progress = lesson.videoProgress[0]
  const youtubeVideoId =
    lesson.videoProvider === VideoProvider.YOUTUBE && lesson.videoUrl
      ? parseYouTubeVideoId(lesson.videoUrl)
      : null
  const html5VideoUrl =
    lesson.videoProvider === VideoProvider.HTML5
      ? lesson.videoUrl ??
        (lesson.videoFileAsset
          ? `/api/files/${lesson.videoFileAsset.id}/download`
          : null)
      : null

  return (
    <main className="role-student-surface flex-1 px-4 py-8">
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

        <SectionBlock
          title={
            lesson.contentType === "FILE"
              ? "Lesson file"
              : lesson.contentType === "VIDEO"
                ? "Lesson video"
                : "Lesson content"
          }
        >
          {lesson.contentType === "FILE" ? (
            lesson.videoFileAsset ? (
              <div className="rounded-lg border bg-background p-4">
                <p className="font-medium">{lesson.videoFileAsset.originalName}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Download or open the lesson file through the LMS.
                </p>
                <Button asChild className="mt-3" size="sm">
                  <Link
                    href={`/api/files/${lesson.videoFileAsset.id}/download`}
                    target="_blank"
                  >
                    Download file
                  </Link>
                </Button>
              </div>
            ) : (
              <EmptyState>No file has been attached to this lesson yet.</EmptyState>
            )
          ) : lesson.contentType !== "VIDEO" ? (
            <div className="rounded-lg border bg-background p-4">
              <p className="font-medium">Marked complete</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Opening this {lesson.contentType.toLowerCase()} lesson records it
                as completed.
              </p>
              {lesson.description ? (
                <p className="mt-4 whitespace-pre-wrap text-sm">
                  {lesson.description}
                </p>
              ) : null}
            </div>
          ) : youtubeVideoId ? (
            <YouTubePlayer
              classSectionId={classSectionId}
              initialCompleted={progress?.completed ?? false}
              initialDurationSeconds={
                progress?.durationSeconds ?? lesson.durationSeconds ?? 0
              }
              initialPositionSeconds={progress?.lastPositionSeconds ?? 0}
              initialProgressRate={Number(progress?.progressRate ?? 0)}
              initialWatchedSeconds={progress?.watchedSeconds ?? 0}
              lessonId={lesson.id}
              videoId={youtubeVideoId}
            />
          ) : lesson.videoProvider === VideoProvider.YOUTUBE ? (
            <EmptyState>This YouTube lesson has an invalid video URL.</EmptyState>
          ) : html5VideoUrl ? (
            <VideoProgressPlayer
              classSectionId={classSectionId}
              durationSeconds={lesson.durationSeconds}
              initialCompleted={progress?.completed ?? false}
              initialLastPositionSeconds={progress?.lastPositionSeconds ?? 0}
              initialProgressRate={Number(progress?.progressRate ?? 0)}
              initialWatchedSeconds={progress?.watchedSeconds ?? 0}
              lessonId={lesson.id}
              videoUrl={html5VideoUrl}
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
