import { BoardScopeType, BoardType } from "@prisma/client"

export const BOARD_KIND_OPTIONS = [
  "SCHOOL_ANNOUNCEMENTS",
  "CLASS_ANNOUNCEMENTS",
  "CLASS_QA",
  "CLASS_RESOURCES",
  "GENERAL_DISCUSSION",
] as const

export type BoardKind = (typeof BOARD_KIND_OPTIONS)[number]

export type BoardSettings = {
  boardKind: BoardKind
  allowStudentPosts: boolean
  allowParentPosts: boolean
  allowComments: boolean
}

export const DEFAULT_BOARD_SETTINGS: BoardSettings = {
  boardKind: "GENERAL_DISCUSSION",
  allowStudentPosts: false,
  allowParentPosts: false,
  allowComments: true,
}

export function boardKindLabel(kind: BoardKind) {
  return {
    SCHOOL_ANNOUNCEMENTS: "School announcements",
    CLASS_ANNOUNCEMENTS: "Class announcements",
    CLASS_QA: "Class Q&A",
    CLASS_RESOURCES: "Class resources",
    GENERAL_DISCUSSION: "General discussion",
  }[kind]
}

export function boardKindHelp(kind: BoardKind) {
  return {
    SCHOOL_ANNOUNCEMENTS:
      "Announcements are read-only for students unless posting is enabled.",
    CLASS_ANNOUNCEMENTS:
      "Class announcements are managed by assigned instructors and admins.",
    CLASS_QA: "Q&A boards allow students to ask class questions.",
    CLASS_RESOURCES: "Resources boards are for class materials.",
    GENERAL_DISCUSSION:
      "General discussion boards support broader community conversations.",
  }[kind]
}

export function getBoardTypeForKind(kind: BoardKind) {
  return {
    SCHOOL_ANNOUNCEMENTS: BoardType.NOTICE,
    CLASS_ANNOUNCEMENTS: BoardType.NOTICE,
    CLASS_QA: BoardType.QNA,
    CLASS_RESOURCES: BoardType.MATERIAL,
    GENERAL_DISCUSSION: BoardType.GENERAL,
  }[kind]
}

export function getBoardScopeTypeForKind(kind: BoardKind, hasClass: boolean) {
  if (hasClass) return BoardScopeType.CLASS_SECTION
  if (kind === "SCHOOL_ANNOUNCEMENTS") return BoardScopeType.CAMPUS
  return BoardScopeType.ORGANIZATION
}

export function getBoardSettings(settings: unknown): BoardSettings {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    return DEFAULT_BOARD_SETTINGS
  }

  const value = settings as Record<string, unknown>
  const boardKind = BOARD_KIND_OPTIONS.includes(value.boardKind as BoardKind)
    ? (value.boardKind as BoardKind)
    : DEFAULT_BOARD_SETTINGS.boardKind

  return {
    boardKind,
    allowStudentPosts:
      typeof value.allowStudentPosts === "boolean"
        ? value.allowStudentPosts
        : DEFAULT_BOARD_SETTINGS.allowStudentPosts,
    allowParentPosts:
      typeof value.allowParentPosts === "boolean"
        ? value.allowParentPosts
        : DEFAULT_BOARD_SETTINGS.allowParentPosts,
    allowComments:
      typeof value.allowComments === "boolean"
        ? value.allowComments
        : DEFAULT_BOARD_SETTINGS.allowComments,
  }
}
