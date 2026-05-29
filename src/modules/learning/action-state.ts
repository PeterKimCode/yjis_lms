export type LessonActionState = {
  uploadedVideoFileAssetId?: string
  uploadedVideoFileLabel?: string
  ok: boolean
  message: string
}

export const initialLessonActionState: LessonActionState = {
  ok: false,
  message: "",
}
