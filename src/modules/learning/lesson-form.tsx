"use client"

import { useActionState, useEffect, useMemo, useRef, useState } from "react"

import { ActionFeedback } from "@/components/action-feedback"
import { ConfirmSubmitButton } from "@/components/confirm-submit-button"
import { Button } from "@/components/ui/button"
import { DraftNotice, useFormDraft } from "@/components/use-form-draft"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { initialLessonActionState } from "@/modules/learning/action-state"
import {
  deleteLesson,
  saveLesson,
} from "@/modules/learning/actions"

import { uploadVideoInParts } from "@/modules/learning/upload-video"

const selectableContentTypes = [
  "VIDEO",
  "TEXT",
  "FILE",
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
  week?: number | null
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
  const videoUploadAbortRef = useRef<AbortController | null>(null)
  const videoFileInputRef = useRef<HTMLInputElement>(null)
  const attachmentInputRef = useRef<HTMLInputElement>(null)
  const uploadRequestRef = useRef<XMLHttpRequest | null>(null)
  useEffect(() => () => { videoUploadAbortRef.current?.abort(); uploadRequestRef.current?.abort() }, [])
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
  const draftForm = useRef<HTMLFormElement>(null)
  const draft = useFormDraft({
    form: draftForm,
    scope: `lesson:${classSectionId}:${lesson?.id ?? "new"}`,
    saved: saveState.ok,
    getExtra: () => ({ contentType, videoProvider, selectedVideoFileAssetId, uploadedFileId: uploadedFile?.id }),
    restoreExtra: (raw) => {
      if (!raw || typeof raw !== "object") return
      const value = raw as Record<string, unknown>
      if (selectableContentTypes.includes(value.contentType as typeof selectableContentTypes[number])) setContentType(value.contentType as ContentType)
      if (value.videoProvider === "HTML5" || value.videoProvider === "YOUTUBE") setVideoProvider(value.videoProvider)
      const options = value.contentType === "FILE" ? fileAssetOptions : videoFileOptions
      if (typeof value.selectedVideoFileAssetId === "string" && options.some((item) => item.id === value.selectedVideoFileAssetId)) setSelectedVideoFileAssetId(value.selectedVideoFileAssetId)
      else setSelectedVideoFileAssetId(lesson?.videoFileAssetId ?? "")
    },
  })
  useEffect(() => {
    if (uploadedVideo || uploadedFile) draftForm.current?.dispatchEvent(new Event("lms-draft-change"))
  }, [uploadedVideo, uploadedFile])
  async function handleUploadVideo(file = videoFileInputRef.current?.files?.[0]) {
    if (!file || isUploading) return
    const controller = new AbortController()
    videoUploadAbortRef.current = controller
    setIsUploading(true)
    setUploadProgress(0)
    setUploadMessage("")
    setUploadOk(true)
    try {
      const asset = await uploadVideoInParts(file, classSectionId, controller.signal, setUploadProgress)
      setUploadedVideo(asset)
      setSelectedVideoFileAssetId(asset.id)
      setUploadMessage("Video uploaded.")
    } catch (error) {
      setUploadOk(false)
      setUploadMessage(controller.signal.aborted ? "Video upload canceled." : error instanceof Error ? error.message : "Video upload failed. Please retry.")
    } finally {
      videoUploadAbortRef.current = null
      setIsUploading(false)
    }
  }

  function handleUploadLessonFile() {
    const file = attachmentInputRef.current?.files?.[0]

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
    videoUploadAbortRef.current?.abort()
    uploadRequestRef.current?.abort()
  }

  return (
    <div className="min-w-0 space-y-3 rounded-md border bg-background p-3 [overflow-wrap:anywhere]">
      <form ref={draftForm} action={saveAction} className="space-y-3">
        <DraftNotice draft={draft} />
        <input name="id" type="hidden" value={lesson?.id ?? ""} />
        <input name="classSectionId" type="hidden" value={classSectionId} />
        {lesson ? (
          <input name="sequence" type="hidden" value={lesson.sequence} />
        ) : null}
        <div className="grid gap-3 md:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span>Week</span>
            <Input className="h-9" name="week" type="number" min={1} defaultValue={lesson?.week ?? ""} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Title</span>
            <Input className="h-9" name="title" required defaultValue={lesson?.title ?? ""} />
          </label>
          {lesson ? (
            <div className="grid gap-1 text-sm md:col-span-2">
              <span className="font-medium">Order</span>
              <div className="h-9 rounded-md border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                {lesson.sequence}
              </div>
            </div>
          ) : null}
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Content type</span>
            {isLegacyType ? (
              <>
                <input name="contentType" type="hidden" value={contentType} />
                <div className="h-9 rounded-md border bg-muted/50 px-3 py-2 text-sm">
                  {contentType} (legacy)
                </div>
              </>
            ) : (
              <select
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                name="contentType"
                disabled={isUploading}
                value={contentType}
                onChange={(event) => setContentType(event.target.value as ContentType)}
              >
                <option value="TEXT">Text</option>
                <option value="VIDEO">Video</option>
                <option value="FILE">File</option>
              </select>
            )}
          </label>
          {isVideo ? (
            <label className="grid gap-1 text-sm">
              <span className="font-medium">Video source</span>
              <select className="h-9 w-full rounded-md border bg-background px-3 text-sm" name="videoProvider" value={videoProvider} disabled={isUploading} onChange={(event) => { setVideoProvider(event.target.value as VideoProvider); setSelectedUploadFileName("") }}>
                {videoProviders.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          ) : null}
          {isVideo && videoProvider === "YOUTUBE" ? (
            <label className="grid gap-1 text-sm md:col-span-2">
              <span className="font-medium">YouTube URL</span>
              <Input
                className="h-9"
                name="videoUrl"
                placeholder="https://www.youtube.com/watch?v=..."
                defaultValue={lesson?.videoUrl ?? ""}
              />
            </label>
          ) : isVideo ? (
            <input name="videoUrl" type="hidden" value="" />
          ) : null}
          {isVideo && videoProvider === "HTML5" ? (
            <div className="space-y-2 text-sm md:col-span-2">
              <label className="grid gap-1">
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
                      ? "Select uploaded video"
                      : "No uploaded videos yet. Upload a video below."}
                  </option>
                  {effectiveVideoFileOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="space-y-3 rounded-md border border-sky-200 bg-sky-50/80 p-3">
                <label className="grid gap-2 text-sm">
                  <span className="font-medium text-sky-950">
                    Upload video to LMS
                  </span>
                  <span className="block text-xs text-sky-800">
                    MP4, WebM, MOV, or M4V only. Max 500MB.
                  </span>
                  <Input
                    ref={videoFileInputRef}
                    disabled={isUploading}
                    id={`lesson-video-file-${classSectionId}-${lesson?.id ?? "new"}`}
                    accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v"
                    className="h-10 border-sky-300 bg-white file:mr-3 file:rounded-md file:border-0 file:bg-sky-100 file:px-3 file:py-1 file:text-sky-800"
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0]
                      setSelectedUploadFileName(file?.name ?? "")
                      setSelectedVideoFileAssetId("")
                      if (file) void handleUploadVideo(file)
                    }}
                    type="file"
                  />
                  {selectedUploadFileName ? (
                    <span className="block break-all text-xs font-medium text-sky-800">
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
                      Uploading video: {uploadProgress}%
                    </p>
                  </div>
                ) : null}
                <div className="flex flex-wrap items-center gap-3">
                  {!isUploading && !uploadOk && selectedUploadFileName ? (
                    <Button onClick={() => void handleUploadVideo()} size="sm" type="button" variant="outline">Retry upload</Button>
                  ) : null}
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
              <label className="grid gap-1">
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
              </label>
              <div className="space-y-3 rounded-md border border-indigo-200 bg-indigo-50/80 p-3">
                <label className="grid gap-2 text-sm">
                  <span className="font-medium text-indigo-950">
                    Upload lesson file to LMS
                  </span>
                  <Input
                    ref={attachmentInputRef}
                    disabled={isUploading}
                    id={`lesson-attachment-file-${classSectionId}-${lesson?.id ?? "new"}`}
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.md,.csv,.png,.jpg,.jpeg,.webp,.gif,.zip,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/markdown,text/csv,image/png,image/jpeg,image/webp,image/gif,application/zip"
                    className="h-10 border-indigo-300 bg-white file:mr-3 file:rounded-md file:border-0 file:bg-indigo-100 file:px-3 file:py-1 file:text-indigo-800"
                    onChange={(event) =>
                      setSelectedUploadFileName(
                        event.currentTarget.files?.[0]?.name ?? ""
                      )
                    }
                    type="file"
                  />
                  {selectedUploadFileName ? (
                    <span className="block break-all text-xs font-medium text-indigo-800">
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
                      Uploading file: {uploadProgress}%
                    </p>
                  </div>
                ) : null}
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    className="min-h-10 w-full px-4 sm:w-auto"
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
          <label className="grid gap-1 text-sm md:col-span-2">
            <span className="font-medium">Description</span>
            <Textarea
              name="description"
              placeholder="Describe what students will learn in this lesson."
              rows={3}
              defaultValue={lesson?.description ?? ""}
            />
          </label>
        </div>
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
        <Button size="sm" type="submit" disabled={isSaving || isUploading}>
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
