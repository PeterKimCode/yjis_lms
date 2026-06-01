"use client"

import { useActionState, useId, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { initialLessonActionState } from "@/modules/learning/action-state"
import {
  deleteLesson,
  saveLesson,
  uploadLessonVideo,
} from "@/modules/learning/actions"

const contentTypes = [
  "VIDEO",
  "TEXT",
  "FILE",
  "QUIZ",
  "ASSIGNMENT",
  "LIVE_SESSION",
] as const

const videoProviders = [
  ["HTML5", "HTML5 / Direct video or MinIO"],
  ["YOUTUBE", "YouTube"],
] as const

type ContentType = (typeof contentTypes)[number]
type VideoProvider = (typeof videoProviders)[number][0]

export type LessonFormValue = {
  id: string
  title: string
  description: string | null
  sequence: number
  contentType: ContentType
  videoProvider?: VideoProvider
  videoUrl: string | null
  videoFileAssetId: string | null
  durationSeconds: number | null
  isPublished: boolean
}

export function LessonForm({
  classSectionId,
  lesson,
  videoFileOptions,
}: {
  classSectionId: string
  lesson?: LessonFormValue
  videoFileOptions: { id: string; label: string }[]
}) {
  const [saveState, saveAction, isSaving] = useActionState(
    saveLesson,
    initialLessonActionState
  )
  const [uploadState, uploadAction, isUploading] = useActionState(
    uploadLessonVideo,
    initialLessonActionState
  )
  const uploadFormId = useId()
  const [contentType, setContentType] = useState<ContentType>(
    lesson?.contentType ?? "TEXT"
  )
  const [videoProvider, setVideoProvider] = useState<VideoProvider>(
    lesson?.videoProvider ?? "HTML5"
  )
  const [selectedUploadFileName, setSelectedUploadFileName] = useState("")
  const isEditing = Boolean(lesson)
  const isVideo = contentType === "VIDEO"
  const selectedVideoFileAssetId =
    uploadState.uploadedVideoFileAssetId ?? lesson?.videoFileAssetId ?? ""
  const effectiveVideoFileOptions = useMemo(() => {
    if (
      uploadState.uploadedVideoFileAssetId &&
      !videoFileOptions.some((option) => option.id === uploadState.uploadedVideoFileAssetId)
    ) {
      return [
        ...videoFileOptions,
        {
          id: uploadState.uploadedVideoFileAssetId,
          label: uploadState.uploadedVideoFileLabel ?? "Uploaded video",
        },
      ]
    }

    return videoFileOptions
  }, [
    uploadState.uploadedVideoFileAssetId,
    uploadState.uploadedVideoFileLabel,
    videoFileOptions,
  ])
  const note = useMemo(() => {
    if (contentType === "FILE") {
      return "Detailed file linking will be added in the files module."
    }

    if (["QUIZ", "ASSIGNMENT", "LIVE_SESSION"].includes(contentType)) {
      return "Detailed linking for this content type will be added in a later module."
    }

    return ""
  }, [contentType])

  return (
    <div className="space-y-3 rounded-md border bg-background p-3">
      <form action={uploadAction} id={uploadFormId} />
      <form action={saveAction} className="space-y-3">
        <input name="id" type="hidden" value={lesson?.id ?? ""} />
        <input name="classSectionId" type="hidden" value={classSectionId} />
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium">Title</span>
            <Input name="title" required defaultValue={lesson?.title ?? ""} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Order</span>
            <Input
              min={1}
              name="sequence"
              required
              type="number"
              defaultValue={lesson?.sequence ?? 1}
            />
          </label>
          <label className="space-y-1 text-sm">
            <span className="font-medium">Content type</span>
            <select
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              name="contentType"
              value={contentType}
              onChange={(event) => setContentType(event.target.value as ContentType)}
            >
              {contentTypes.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          {isVideo ? (
            <label className="space-y-1 text-sm">
              <span className="font-medium">Video provider</span>
              <select
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                name="videoProvider"
                value={videoProvider}
                onChange={(event) =>
                  setVideoProvider(event.target.value as VideoProvider)
                }
              >
                {videoProviders.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {isVideo ? (
            <label className="space-y-1 text-sm">
              <span className="font-medium">Video duration (seconds)</span>
              <Input
                min={0}
                name="durationSeconds"
                placeholder="Example: 5 minutes = 300"
                type="number"
                defaultValue={lesson?.durationSeconds ?? ""}
              />
              <span className="text-xs text-muted-foreground">
                Used to calculate completion rate. Leave blank for text lessons.
              </span>
            </label>
          ) : null}
          {isVideo ? (
            <label className="space-y-1 text-sm md:col-span-2">
              <span className="font-medium">Video URL</span>
              <Input
                name="videoUrl"
                placeholder="https://example.com/video.mp4 or YouTube URL"
                defaultValue={lesson?.videoUrl ?? ""}
              />
              <span className="text-xs text-muted-foreground">
                For YouTube, select YouTube provider. For direct video, select
                HTML5.
              </span>
            </label>
          ) : null}
          {isVideo && videoProvider === "HTML5" ? (
            <div className="space-y-2 text-sm md:col-span-2">
              <label className="space-y-1">
                <span className="font-medium">Uploaded video file</span>
                <select
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  key={selectedVideoFileAssetId || "no-video-file"}
                  name="videoFileAssetId"
                  defaultValue={selectedVideoFileAssetId}
                >
                  <option value="">
                    {effectiveVideoFileOptions.length
                      ? "Select uploaded MinIO video"
                      : "No uploaded videos yet. Upload a video below."}
                  </option>
                  {effectiveVideoFileOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <span className="block text-xs text-muted-foreground">
                  Upload through the LMS so FileAsset metadata exists. Files
                  uploaded directly in the MinIO Console do not appear here.
                </span>
              </label>
              <div className="space-y-3 rounded-md border border-sky-200 bg-sky-50/80 p-3">
                <input
                  form={uploadFormId}
                  name="classSectionId"
                  type="hidden"
                  value={classSectionId}
                />
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-sky-950">
                    Upload video to LMS
                  </span>
                  <span className="block text-xs text-sky-800">
                    Upload through the LMS so FileAsset metadata exists for the
                    dropdown.
                  </span>
                  <Input
                    accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v"
                    className="border-sky-300 bg-white file:mr-3 file:rounded-md file:border-0 file:bg-sky-100 file:px-3 file:py-1 file:text-sky-800"
                    form={uploadFormId}
                    name="videoFile"
                    onChange={(event) =>
                      setSelectedUploadFileName(
                        event.currentTarget.files?.[0]?.name ?? ""
                      )
                    }
                    type="file"
                  />
                  {selectedUploadFileName ? (
                    <span className="block text-xs font-medium text-sky-800">
                      Selected: {selectedUploadFileName}
                    </span>
                  ) : null}
                </label>
                {isUploading ? (
                  <div className="space-y-1" role="status">
                    <div className="h-2 overflow-hidden rounded-full bg-sky-100">
                      <div className="h-full w-1/2 animate-pulse rounded-full bg-sky-600" />
                    </div>
                    <p className="text-xs text-sky-800">
                      Uploading video. Please keep this page open until it
                      finishes.
                    </p>
                  </div>
                ) : null}
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    className="bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-slate-300"
                    form={uploadFormId}
                    size="sm"
                    type="submit"
                    disabled={isUploading || !selectedUploadFileName}
                  >
                    {isUploading ? "Uploading..." : "Upload video"}
                  </Button>
                  {uploadState.message ? (
                    <p
                      className={`text-sm ${uploadState.ok ? "text-muted-foreground" : "text-destructive"}`}
                      role="status"
                    >
                      {uploadState.message}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
          <label className="space-y-1 text-sm md:col-span-2">
            <span className="font-medium">Description</span>
            <Textarea
              name="description"
              placeholder="Describe what students will learn in this lesson."
              rows={3}
              defaultValue={lesson?.description ?? ""}
            />
          </label>
        </div>
        {note ? <p className="text-sm text-muted-foreground">{note}</p> : null}
        {saveState.message ? (
          <p
            className={`text-sm ${saveState.ok ? "text-muted-foreground" : "text-destructive"}`}
            role="status"
          >
            {saveState.message}
          </p>
        ) : null}
        <label className="flex items-center gap-2 text-sm">
          <input
            className="size-4"
            name="isPublished"
            type="checkbox"
            defaultChecked={lesson?.isPublished ?? false}
          />
          Published
        </label>
        <Button size="sm" type="submit" disabled={isSaving}>
          {isSaving
            ? "Saving..."
            : isEditing
              ? "Save lesson"
              : "Create lesson"}
        </Button>
      </form>
      {lesson ? (
        <form action={deleteLesson}>
          <input name="lessonId" type="hidden" value={lesson.id} />
          <Button size="sm" type="submit" variant="destructive">
            Delete
          </Button>
        </form>
      ) : null}
    </div>
  )
}
