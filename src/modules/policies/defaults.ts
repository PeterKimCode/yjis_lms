export const DEFAULT_ATTENDANCE_POLICY = {
  lateThresholdMinutes: 10,
  absenceFailThresholdRate: null as number | null,
  countLateAsAbsence: false,
  lateEquivalentAbsenceCount: 0,
  excusedCountsAsPresent: false,
  excusedCountsAgainstAttendance: false,
  allowInstructorOverride: true,
}

export const DEFAULT_VIDEO_COMPLETION_POLICY = {
  completionThresholdPercent: 90,
  minimumWatchSeconds: null as number | null,
  requireActualWatchedCoverage: true,
}

export const DEFAULT_ASSIGNMENT_POLICY = {
  allowLateSubmissionDefault: false,
  allowResubmissionBeforeDue: true,
  latePenaltyPercent: 0,
  maxLateDays: null as number | null,
}

export const DEFAULT_GRADE_VISIBILITY_POLICY = {
  studentsCanSeeDraftGrades: false,
  parentsCanSeeDraftGrades: false,
  showAssignmentFeedbackBeforeFinalGrade: true,
  showQuizResultsImmediately: true,
}

export const DEFAULT_DOCUMENT_POLICY = {
  reportCardsRequirePublishedGrades: true,
  transcriptsRequirePublishedGrades: true,
}

export const POLICY_NAMES = {
  attendance: "Default Attendance Policy",
  videoCompletion: "Default Video Completion Policy",
  grading: "Default Grading Policy",
  academic: "Default Academic Policy",
}

