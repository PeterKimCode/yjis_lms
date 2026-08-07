"use client"

import { useActionState, useMemo, useRef, useState } from "react"

import { ActionFeedback } from "@/components/action-feedback"
import { ConfirmSubmitButton } from "@/components/confirm-submit-button"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { initialLessonActionState } from "@/modules/learning/action-state"
import {
  deleteLesson,
  saveLesson,
} from "@/modules/learning/actions"

const selectableContentTypes = [
  "VIDEO",
  "TEXT",
] as const

const videoProviders = [
  ["YOUTUBE", "Video: YouTube"],
  ["HTML5", "Video: Upload"],
] as const

type ContentType =
  | (typeof selectableContentTypes)[number]
  | "FILE"
  | "QUIZ"
  | "ASSIGNMENT"
  | "LIVE_SESSION"
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
  fileAssetOptions,
  lesson,
  videoFileOptions,
}: {
  classSectionId: string
  fileAssetOptions: { id: string; label: string }[]
  lesson?: LessonFormValue
  videoFileOptions: { id: string; label: string }[]
}) {
  const [saveState, saveAction, isSaving] = useActionState(
    saveLesson,
    initialLessonActionState
  )
  const [contentType, setContentType] = useState<ContentType>(
    lesson?.contentType ?? "TEXT"
  )
  const [videoProvider, setVideoProvider] = useState<VideoProvider>(
    lesson?.videoProvider === "YOUTUBE" ? "YOUTUBE" : "HTML5"
  )
  const [selectedUploadFileName, setSelectedUploadFileName] = useState("")
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadMessage, setUploadMessage] = useState("")
  const [uploadOk, setUploadOk] = useState(true)
  const uploadRequestRef = useRef<XMLHttpRequest | null>(null)
  const [uploadedVideo, setUploadedVideo] = useState<{
    id: string
    label: string
  } | null>(null)
  const [uploadedFile, setUploadedFile] = useState<{
    id: string
    label: string
  } | null>(null)
  const [selectedVideoFileAssetId, setSelectedVideoFileAssetId] = useState(
    lesson?.videoFileAssetId ?? ""
  )
  const isEditing = Boolean(lesson)
  const isVideo = contentType === "VIDEO"
  const isFile = contentType === "FILE"
  const isLegacyType =
    !selectableContentTypes.includes(contentType as (typeof selectableContentTypes)[number])
  const effectiveVideoFileOptions = useMemo(() => {
    if (uploadedVideo && !videoFileOptions.some((option) => option.id === uploadedVideo.id)) {
      return [...videoFileOptions, uploadedVideo]
    }

    return videoFileOptions
  }, [uploadedVideo, videoFileOptions])
  const effectiveFileAssetOptions = useMemo(() => {
    if (uploadedFile && !fileAssetOptions.some((option) => option.id === uploadedFile.id)) {
      return [...fileAssetOptions, uploadedFile]
    }

    return fileAssetOptions
  }, [fileAssetOptions, uploadedFile])
  const note = useMemo(() => {
    if (["QUIZ", "ASSIGNMENT", "LIVE_SESSION"].includes(contentType)) {
      return "Detailed linking for this content type will be added in a later module."
    }

    return ""
  }, [contentType])

  function handleUploadVideo() {
    const input = document.getElementById(
      `lesson-video-file-${classSectionId}-${lesson?.id ?? "new"}`
    ) as HTMLInputElement | null
    const file = input?.files?.[0]

    if (!file) {
      setUploadOk(false)
      setUploadMessage("Choose a video file to upload.")
      return
    }

    const formData = new FormData()
    formData.set("classSectionId", classSectionId)
    formData.set("videoFile", file)

    const request = new XMLHttpRequest()
    uploadRequestRef.current = request
    request.open("POST", "/api/learning/lesson-video-upload")
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        setUploadProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)))
      }
    }
    request.onloadstart = () => {
      setIsUploading(true)
      setUploadProgress(0)
      setUploadMessage("")
      setUploadOk(true)
    }
    request.onerror = () => {
      uploadRequestRef.current = null
      setIsUploading(false)
      setUploadOk(false)
      setUploadMessage("Video upload failed. Please try again.")
    }
    request.onabort = () => {
      uploadRequestRef.current = null
      setIsUploading(false)
      setUploadProgress(0)
      setUploadOk(false)
      setUploadMessage("Video upload canceled.")
    }
    request.onload = () => {
      uploadRequestRef.current = null
      setIsUploading(false)

      try {
        const response = JSON.parse(request.responseText) as {
          ok?: boolean
          message?: string
          error?: string
          fileAsset?: { id: string; label: string }
        }

        if (request.status >= 200 && request.status < 300 && response.fileAsset) {
          setUploadProgress(100)
          setUploadedVideo(response.fileAsset)
          setSelectedVideoFileAssetId(response.fileAsset.id)
          setUploadOk(true)
          setUploadMessage(response.message ?? "Video uploaded.")
          return
        }

        setUploadOk(false)
        setUploadMessage(response.error ?? "Video upload failed. Please try again.")
      } catch {
        setUploadOk(false)
        setUploadMessage("Video upload failed. Please try again.")
      }
    }
    request.send(formData)
  }

  function handleUploadLessonFile() {
    const input = document.getElementById(
      `lesson-attachment-file-${classSectionId}-${lesson?.id ?? "new"}`
    ) as HTMLInputElement | null
    const file = input?.files?.[0]

    if (!file) {
      setUploadOk(false)
      setUploadMessage("Choose a lesson file to upload.")
      return
    }

    const formData = new FormData()
    formData.set("classSectionId", classSectionId)
    formData.set("lessonFile", file)

    const request = new XMLHttpRequest()
    uploadRequestRef.current = request
    request.open("POST", "/api/learning/lesson-file-upload")
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        setUploadProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)))
      }
    }
    request.onloadstart = () => {
      setIsUploading(true)
      setUploadProgress(0)
      setUploadMessage("")
      setUploadOk(true)
    }
    request.onerror = () => {
      uploadRequestRef.current = null
      setIsUploading(false)
      setUploadOk(false)
      setUploadMessage("Lesson file upload failed. Please try again.")
    }
    request.onabort = () => {
      uploadRequestRef.current = null
      setIsUploading(false)
      setUploadProgress(0)
      setUploadOk(false)
      setUploadMessage("File upload canceled.")
    }
    request.onload = () => {
      uploadRequestRef.current = null
      setIsUploading(false)

      try {
        const response = JSON.parse(request.responseText) as {
          ok?: boolean
          message?: string
          error?: string
          fileAsset?: { id: string; label: string }
        }

        if (request.status >= 200 && request.status < 300 && response.fileAsset) {
          setUploadProgress(100)
          setUploadedFile(response.fileAsset)
          setSelectedVideoFileAssetId(response.fileAsset.id)
          setUploadOk(true)
          setUploadMessage(response.message ?? "Lesson file uploaded.")
          return
        }

        setUploadOk(false)
        setUploadMessage(response.error ?? "Lesson file upload failed. Please try again.")
      } catch {
        setUploadOk(false)
        setUploadMessage("Lesson file upload failed. Please try again.")
      }
    }
    request.send(formData)
  }

  function cancelUploadVideo() {
    uploadRequestRef.current?.abort()
  }

  return (
    <div className="space-y-3 rounded-md border bg-background p-3">
      <form action={saveAction} className="space-y-3">
        <input name="id" type="hidden" value={lesson?.id ?? ""} />
        <input name="classSectionId" type="hidden" value={classSectionId} />
        {lesson ? (
          <input name="sequence" type="hidden" value={lesson.sequence} />
        ) : null}
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="font-medium">Title</span>
            <Input name="title" required defaultValue={lesson?.title ?? ""} />
          </label>
          {lesson ? (
            <div className="space-y-1 text-sm">
              <span className="font-medium">Order</span>
              <div className="h-9 rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                {lesson.sequence}
              </div>
            </div>
          ) : null}
          <label className="space-y-1 text-sm">
            <span className="font-medium">Content type</span>
            {isLegacyType ? (
              <>
                <input name="contentType" type="hidden" value={contentType} />
                <div className="h-9 rounded-md border bg-muted/50 px-3 py-2 text-sm">
                  {contentType} (legacy)
                </div>
                <span className="text-xs text-muted-foreground">
                  Existing legacy lessons are preserved. New lessons can be Text
                  or Video only.
                </span>
              </>
            ) : (
              <select
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                name="contentType"
                value={contentType}
                onChange={(event) => setContentType(event.target.value as ContentType)}
              >
                <option value="TEXT">Text</option>
                <option value="VIDEO">Video</option>
              </select>
            )}
          </label>
          {isVideo ? (
            <label className="space-y-1 text-sm">
              <span className="font-medium">Video source</span>
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
          {isVideo && videoProvider === "YOUTUBE" ? (
            <label className="space-y-1 text-sm md:col-span-2">
              <span className="font-medium">YouTube URL</span>
              <Input
                name="videoUrl"
                placeholder="https://www.youtube.com/watch?v=..."
                defaultValue={lesson?.videoUrl ?? ""}
              />
              <span className="text-xs text-muted-foreground">
                Paste a YouTube link. Uploaded videos use the Upload mode below.
              </span>
            </label>
          ) : isVideo ? (
            <input name="videoUrl" type="hidden" value="" />
          ) : null}
          {isVideo && videoProvider === "HTML5" ? (
            <div className="space-y-2 text-sm md:col-span-2">
              <label className="space-y-1">
                <span className="font-medium">Uploaded video file</span>
                <select
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  key={selectedVideoFileAssetId || "no-video-file"}
                  name="videoFileAssetId"
                  onChange={(event) =>
                    setSelectedVideoFileAssetId(event.target.value)
                  }
                  value={selectedVideoFileAssetId}
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
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-sky-950">
                    Upload video to LMS
                  </span>
                  <span className="block text-xs text-sky-800">
                    Upload through the LMS so FileAsset metadata exists for the
                    dropdown. MP4, WebM, MOV, or M4V only. Max 500MB.
                  </span>
                  <Input
                    id={`lesson-video-file-${classSectionId}-${lesson?.id ?? "new"}`}
                    accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v"
                    className="border-sky-300 bg-white file:mr-3 file:rounded-md file:border-0 file:bg-sky-100 file:px-3 file:py-1 file:text-sky-800"
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
                      <div
                        className="h-full rounded-full bg-sky-600 transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <p className="text-xs text-sky-800">
                      Uploading video: {uploadProgress}%. Please keep this page
                      open until it finishes.
                    </p>
                  </div>
                ) : null}
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    className="bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-slate-300"
                    onClick={handleUploadVideo}
                    size="sm"
                    type="button"
                    disabled={isUploading || !selectedUploadFileName}
                  >
                    {isUploading ? "Uploading..." : "Upload video"}
                  </Button>
                  {isUploading ? (
                    <Button
                      onClick={cancelUploadVideo}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      Cancel upload
                    </Button>
                  ) : null}
                  {uploadMessage ? (
                    <p
                      className={`text-sm ${uploadOk ? "text-muted-foreground" : "text-destructive"}`}
                      role="status"
                    >
                      {uploadMessage}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
          {isFile ? (
            <div className="space-y-2 text-sm md:col-span-2">
              <label className="space-y-1">
                <span className="font-medium">Uploaded lesson file</span>
                <select
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  key={selectedVideoFileAssetId || "no-lesson-file"}
                  name="videoFileAssetId"
                  onChange={(event) =>
                    setSelectedVideoFileAssetId(event.target.value)
                  }
                  value={selectedVideoFileAssetId}
                >
                  <option value="">
                    {effectiveFileAssetOptions.length
                      ? "Select uploaded lesson file"
                      : "No uploaded lesson files yet. Upload a file below."}
                  </option>
                  {effectiveFileAssetOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <span className="block text-xs text-muted-foreground">
                  Allowed: PDF, Office files, text, images, CSV, and ZIP. Max
                  20MB. Executable/script files are blocked.
                </span>
              </label>
              <div className="space-y-3 rounded-md border border-indigo-200 bg-indigo-50/80 p-3">
                <label className="space-y-2 text-sm">
                  <span className="font-medium text-indigo-950">
                    Upload lesson file to LMS
                  </span>
                  <span className="block text-xs text-indigo-800">
                    Upload PPT, PDF, Word, Excel, text, image, CSV, or ZIP files
                    for this lesson.
                  </span>
                  <Input
                    id={`lesson-attachment-file-${classSectionId}-${lesson?.id ?? "new"}`}
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.csv,.png,.jpg,.jpeg,.webp,.gif,.zip,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/markdown,text/csv,image/png,image/jpeg,image/webp,image/gif,application/zip"
                    className="border-indigo-300 bg-white file:mr-3 file:rounded-md file:border-0 file:bg-indigo-100 file:px-3 file:py-1 file:text-indigo-800"
                    onChange={(event) =>
                      setSelectedUploadFileName(
                        event.currentTarget.files?.[0]?.name ?? ""
                      )
                    }
                    type="file"
                  />
                  {selectedUploadFileName ? (
                    <span className="block text-xs font-medium text-indigo-800">
                      Selected: {selectedUploadFileName}
                    </span>
                  ) : null}
                </label>
                {isUploading ? (
                  <div className="space-y-1" role="status">
                    <div className="h-2 overflow-hidden rounded-full bg-indigo-100">
                      <div
                        className="h-full rounded-full bg-indigo-600 transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <p className="text-xs text-indigo-800">
                      Uploading file: {uploadProgress}%. Please keep this page
                      open until it finishes.
                    </p>
                  </div>
                ) : null}
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    className="bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-slate-300"
                    onClick={handleUploadLessonFile}
                    size="sm"
                    type="button"
                    disabled={isUploading || !selectedUploadFileName}
                  >
                    {isUploading ? "Uploading..." : "Upload file"}
                  </Button>
                  {isUploading ? (
                    <Button
                      onClick={cancelUploadVideo}
                      size="sm"
                      type="button"
                      variant="outline"
                    >
                      Cancel upload
                    </Button>
                  ) : null}
                  {uploadMessage ? (
                    <p
                      className={`text-sm ${uploadOk ? "text-muted-foreground" : "text-destructive"}`}
                      role="status"
                    >
                      {uploadMessage}
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
        <ActionFeedback closeOnSuccess state={saveState} />
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
          <ConfirmSubmitButton confirmMessage="Delete this lesson? Students will no longer see it.">
            Delete
          </ConfirmSubmitButton>
        </form>
      ) : null}
    </div>
  )
}
