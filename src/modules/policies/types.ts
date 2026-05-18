import type { GradingScale, GradingScaleItem } from "@prisma/client"

import {
  DEFAULT_ASSIGNMENT_POLICY,
  DEFAULT_ATTENDANCE_POLICY,
  DEFAULT_DOCUMENT_POLICY,
  DEFAULT_GRADE_VISIBILITY_POLICY,
  DEFAULT_VIDEO_COMPLETION_POLICY,
} from "@/modules/policies/defaults"

export type AttendancePolicyValue = typeof DEFAULT_ATTENDANCE_POLICY
export type VideoCompletionPolicyValue = typeof DEFAULT_VIDEO_COMPLETION_POLICY
export type AssignmentPolicyValue = typeof DEFAULT_ASSIGNMENT_POLICY
export type GradeVisibilityPolicyValue = typeof DEFAULT_GRADE_VISIBILITY_POLICY
export type DocumentPolicyValue = typeof DEFAULT_DOCUMENT_POLICY

export type ResolvedPolicies = {
  attendance: AttendancePolicyValue
  videoCompletion: VideoCompletionPolicyValue
  assignment: AssignmentPolicyValue
  gradeVisibility: GradeVisibilityPolicyValue
  document: DocumentPolicyValue
  gradingScale:
    | (GradingScale & {
        items: GradingScaleItem[]
      })
    | null
}
