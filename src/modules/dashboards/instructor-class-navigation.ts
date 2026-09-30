export const instructorClassTabs = [
  { id: "lessons", label: "Lessons" },
  { id: "attendance", label: "Attendance" },
  { id: "assessments", label: "Assessments" },
  { id: "grades", label: "Grades" },
  { id: "boards", label: "Boards" },
] as const

export type InstructorClassTab = (typeof instructorClassTabs)[number]["id"]
export type InstructorClassSection = "lessons" | "attendance" | "sessions" | "assignments" | "quizzes" | "exams" | "grades" | "boards"
export type InstructorClassSelection = {
  tab: InstructorClassTab
  view?: string
  section: InstructorClassSection
}

export function resolveInstructorClassSelection(tab?: string | string[], view?: string | string[]): InstructorClassSelection {
  const selectedTab = instructorClassTabs.find((item) => item.id === tab)?.id ?? "lessons"
  if (selectedTab === "attendance") {
    const selectedView = view === "sessions" ? "sessions" : "attendance"
    return { tab: selectedTab, view: selectedView, section: selectedView }
  }
  if (selectedTab === "assessments") {
    const selectedView = view === "quizzes" || view === "exams" ? view : "assignments"
    return { tab: selectedTab, view: selectedView, section: selectedView }
  }
  return { tab: selectedTab, section: selectedTab }
}

export function instructorClassHref(classSectionId: string, selection: InstructorClassSelection, lessonId?: string) {
  const params = new URLSearchParams({ tab: selection.tab })
  if (selection.view) params.set("view", selection.view)
  if (lessonId && selection.tab === "lessons") params.set("lessonId", lessonId)
  return `/instructor/classes/${encodeURIComponent(classSectionId)}?${params}`
}

export function instructorSelectionForHash(hash: string): InstructorClassSelection | null {
  const section = hash.replace(/^#/, "")
  if (section === "lesson-progress") return resolveInstructorClassSelection("lessons")
  if (section === "sessions" || section === "attendance") return resolveInstructorClassSelection("attendance", section)
  if (["assignments", "quizzes", "exams"].includes(section)) return resolveInstructorClassSelection("assessments", section)
  if (["lessons", "grades", "boards"].includes(section)) return resolveInstructorClassSelection(section)
  return null
}
