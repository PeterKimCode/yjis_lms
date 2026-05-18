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
  adminPreviewAllowed: true,
}

export const DEFAULT_GPA_SCALE = "4.50"

export const DEFAULT_GRADING_SCALE_NAME = "Default A-F Grading Scale"

export const DEFAULT_GRADING_SCALE_DESCRIPTION =
  "Default local development grading scale."

export const DEFAULT_GRADING_SCALE_ITEMS = [
  {
    label: "A+",
    minPercentage: "95.00",
    maxPercentage: "100.00",
    gradePoint: "4.50",
    isPassing: true,
  },
  {
    label: "A",
    minPercentage: "90.00",
    maxPercentage: "94.99",
    gradePoint: "4.00",
    isPassing: true,
  },
  {
    label: "B+",
    minPercentage: "85.00",
    maxPercentage: "89.99",
    gradePoint: "3.50",
    isPassing: true,
  },
  {
    label: "B",
    minPercentage: "80.00",
    maxPercentage: "84.99",
    gradePoint: "3.00",
    isPassing: true,
  },
  {
    label: "C+",
    minPercentage: "75.00",
    maxPercentage: "79.99",
    gradePoint: "2.50",
    isPassing: true,
  },
  {
    label: "C",
    minPercentage: "70.00",
    maxPercentage: "74.99",
    gradePoint: "2.00",
    isPassing: true,
  },
  {
    label: "D",
    minPercentage: "60.00",
    maxPercentage: "69.99",
    gradePoint: "1.00",
    isPassing: true,
  },
  {
    label: "F",
    minPercentage: "0.00",
    maxPercentage: "59.99",
    gradePoint: "0.00",
    isPassing: false,
  },
]

export const POLICY_NAMES = {
  attendance: "Default Attendance Policy",
  videoCompletion: "Default Video Completion Policy",
  grading: "Default Grading Policy",
  academic: "Default Academic Policy",
}
