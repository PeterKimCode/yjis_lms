type Assignment = { role: string; organizationId: string; campusId: string | null }
export function reviewScope(assignments: Assignment[]) {
  if (assignments.some(a => a.role === "SUPER_ADMIN")) return {}
  return { OR: assignments.filter(a => a.role === "SCHOOL_ADMIN").map(a => ({ organizationId: a.organizationId, ...(a.campusId ? { campusId: a.campusId } : {}) })) }
}
export function canReview(assignments: Assignment[], section: { organizationId: string; campusId: string | null }) {
  return assignments.some(a => a.role === "SUPER_ADMIN" || a.role === "SCHOOL_ADMIN" && a.organizationId === section.organizationId && (!a.campusId || a.campusId === section.campusId))
}
export function canPublishNotice(assignments: Assignment[], organizationId: string) {
  return assignments.some(a => a.role === "SUPER_ADMIN" || a.role === "SCHOOL_ADMIN" && a.organizationId === organizationId)
}
export function availableForRequest(section: { isRecruiting: boolean; endsAt: Date | null; organization: { isActive: boolean } }, now = new Date()) {
  return section.isRecruiting && section.organization.isActive && (!section.endsAt || section.endsAt > now)
}
