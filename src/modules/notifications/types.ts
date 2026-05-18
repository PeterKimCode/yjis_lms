import { NotificationType } from "@prisma/client"

export const notificationTypeLabels: Record<NotificationType, string> = {
  ASSIGNMENT_DUE: "Assignment",
  ASSIGNMENT_GRADED: "Assignment",
  ASSIGNMENT_SUBMITTED: "Assignment",
  ATTENDANCE_CHANGED: "Attendance",
  ATTENDANCE_UPDATED: "Attendance",
  FINAL_GRADE_PUBLISHED: "Grade",
  GRADE_PUBLISHED: "Grade",
  NEW_ASSIGNMENT: "Assignment",
  NEW_BOARD_COMMENT: "Board",
  NEW_BOARD_POST: "Board",
  NEW_COMMENT: "Board",
  NEW_MESSAGE: "Message",
  NEW_POST: "Board",
  NEW_QUIZ: "Quiz",
  QUIZ_GRADED: "Quiz",
  QUIZ_OPENED: "Quiz",
  REPORT_CARD_AVAILABLE: "Document",
  SYSTEM_NOTICE: "System",
  TRANSCRIPT_AVAILABLE: "Document",
}

export const notificationFilters = [
  ["all", "All"],
  ["unread", "Unread"],
  ["messages", "Messages"],
  ["assignments", "Assignments"],
  ["quizzes", "Quizzes"],
  ["grades", "Grades"],
  ["boards", "Boards"],
  ["documents", "Documents"],
  ["attendance", "Attendance"],
] as const

export type NotificationActionState = {
  ok: boolean
  message: string
}

export const initialNotificationActionState: NotificationActionState = {
  ok: false,
  message: "",
}
