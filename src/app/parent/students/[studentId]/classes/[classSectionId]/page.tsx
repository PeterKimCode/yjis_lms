import { formatDateTimeInTimeZone } from "@/lib/timezone"
import { assessmentTypeLabel } from "@/modules/quizzes/assessment-types"
import Link from "next/link"
import { notFound } from "next/navigation"
import { UserRole } from "@prisma/client"

import { Button } from "@/components/ui/button"
import { getPrismaClient } from "@/lib/prisma"
import { requireAnyRole } from "@/modules/auth/permissions"
import { getAttendanceSummary } from "@/modules/attendance/summary"
import { getSubmissionStatus } from "@/modules/assignments/status"
import { DashboardPage, SectionBlock, SimpleTable, TableCell, TableRow } from "@/modules/dashboards/components"
import { formatDateTime, getClassSectionDetail, getAttendancePolicyForClassSection } from "@/modules/dashboards/data"
import { InstructorClassTabs } from "@/modules/dashboards/instructor-class-tabs"
import { resolveInstructorClassSelection } from "@/modules/dashboards/instructor-class-navigation"
import { shouldShowQuizResults, getQuizAttemptStatus } from "@/modules/quizzes/status"

export default async function ParentClassPage({ params, searchParams }: {
  params: Promise<{ studentId: string; classSectionId: string }>
  searchParams: Promise<{ tab?: string | string[]; view?: string | string[] }>
}) {
  const parent = await requireAnyRole([UserRole.PARENT])
  const { studentId, classSectionId } = await params
  // Both the exact parent-child relation and this child's enrollment are required.
  const relation = await getPrismaClient().parentStudentRelation.findUnique({
    where: { parentId_studentId: { parentId: parent.id, studentId } },
    select: { student: { select: { name: true, enrollments: { where: { classSectionId }, select: { id: true } } } } },
  })
  if (!relation?.student.enrollments.length) notFound()
  const section = await getClassSectionDetail(studentId, classSectionId, { publishedLessonsOnly: true })
  if (!section) notFound()
  const query = await searchParams
  const selection = resolveInstructorClassSelection(query.tab, query.view)
  const path = `/parent/students/${studentId}/classes/${classSectionId}`
  const records = section.attendanceSessions.flatMap((session) => session.records.filter((record) => record.studentId === studentId))
  const policy = await getAttendancePolicyForClassSection({ organizationId: section.organizationId, campusId: section.campusId, classSectionId })
  const attendance = getAttendanceSummary(records, policy)

  return <DashboardPage title={section.name} description={`${relation.student.name} · ${section.course.title} · ${section.term?.name ?? "No term"}`}>
    <InstructorClassTabs classSectionId={classSectionId} basePath={path} selection={selection}
      actions={<Button asChild size="sm" variant="outline"><Link href="/messages">Messages</Link></Button>} />
    {selection.section === "lessons" ? <SectionBlock id="lessons" title="Lessons">
      <SimpleTable empty="No published lessons yet." headers={["Title", "Type", "Progress", "Status"]} rows={section.lessons.map((lesson) => {
        const progress = lesson.videoProgress.find((item) => item.studentId === studentId)
        return <TableRow key={lesson.id}><TableCell className="font-medium">{lesson.title}</TableCell><TableCell>{lesson.contentType}</TableCell><TableCell>{Number(progress?.progressRate ?? 0).toFixed(1)}%</TableCell><TableCell>{progress?.completed ? "Completed" : "In progress"}</TableCell></TableRow>
      })} />
    </SectionBlock> : null}
    {selection.section === "sessions" ? <SectionBlock id="sessions" title="Sessions">
      <SimpleTable empty="No class sessions yet." headers={["Title", "Starts", "Mode", "Location"]} rows={section.sessions.map((session) => <TableRow key={session.id}><TableCell>{session.title ?? "Class session"}</TableCell><TableCell>{formatDateTime(session.startsAt)}</TableCell><TableCell>{session.deliveryMode}</TableCell><TableCell>{session.location ?? "-"}</TableCell></TableRow>)} />
    </SectionBlock> : null}
    {selection.section === "attendance" ? <SectionBlock id="attendance" title="Attendance">
      <p className="mb-4 text-sm text-muted-foreground">Attendance rate: {attendance.attendanceRate.toFixed(1)}% · Present: {attendance.presentCount} · Late: {attendance.lateCount} · Absent: {attendance.absentCount}</p>
      <SimpleTable empty="No attendance records yet." headers={["Session", "Date", "Status", "Note"]} rows={section.attendanceSessions.flatMap((session) => session.records.filter((record) => record.studentId === studentId).map((record) => <TableRow key={record.id}><TableCell>{session.title ?? session.classSession?.title ?? "Attendance"}</TableCell><TableCell>{formatDateTime(session.takenAt)}</TableCell><TableCell>{record.status}</TableCell><TableCell>{record.note ?? "-"}</TableCell></TableRow>))} />
    </SectionBlock> : null}
    {selection.section === "assignments" ? <SectionBlock id="assignments" title="Assignments">
      <SimpleTable empty="No assignments yet." headers={["Title", "Due", "Status", "Score"]} rows={section.assignments.map((assignment) => {
        const submission = assignment.submissions.find((item) => item.studentId === studentId)
        return <TableRow key={assignment.id}><TableCell>{assignment.title}</TableCell><TableCell>{formatDateTime(assignment.dueAt)}</TableCell><TableCell>{getSubmissionStatus({ dueAt: assignment.dueAt, score: submission?.score, submittedAt: submission?.submittedAt })}</TableCell><TableCell>{submission?.score?.toString() ?? "-"}/{assignment.pointsPossible?.toString() ?? "-"}</TableCell></TableRow>
      })} />
    </SectionBlock> : null}
    {selection.section === "quizzes" ? <SectionBlock id="quizzes" title="Exams / Assessments">
      <SimpleTable empty="No assessments yet." headers={["Title", "Type", "Starts", "Ends", "Status", "Score"]} rows={section.quizzes.map((quiz) => {
        const attempt = quiz.attempts.find((item) => item.studentId === studentId)
        return <TableRow key={quiz.id}><TableCell>{quiz.title}</TableCell><TableCell>{assessmentTypeLabel(quiz.assessmentType)}</TableCell><TableCell>{formatDateTimeInTimeZone(quiz.opensAt,section.organization.timezone)}</TableCell><TableCell>{formatDateTimeInTimeZone(quiz.closesAt,section.organization.timezone)}</TableCell><TableCell>{attempt ? getQuizAttemptStatus(attempt) : "Not started"}</TableCell><TableCell>{attempt && shouldShowQuizResults(quiz) ? attempt.score?.toString() ?? "0" : attempt ? "Results hidden" : "-"}</TableCell></TableRow>
      })} />
    </SectionBlock> : null}
    {selection.section === "grades" ? <SectionBlock id="grades" title="Grades">
      <div className="mt-4"><SimpleTable empty="Final grade is not published yet." headers={["Final score", "Letter", "Grade point", "Credits"]} rows={section.finalGrades.map((grade) => <TableRow key={grade.id}><TableCell>{grade.percentage?.toString() ?? grade.numericScore?.toString() ?? "-"}</TableCell><TableCell>{grade.letterGrade ?? "-"}</TableCell><TableCell>{grade.gradePoint?.toString() ?? "-"}</TableCell><TableCell>{grade.creditsEarned?.toString() ?? "0"}</TableCell></TableRow>)} /></div>
    </SectionBlock> : null}
    {selection.section === "boards" ? <SectionBlock id="boards" title="Boards">
      <SimpleTable empty="No boards yet." headers={["Name", "Open"]} rows={section.boards.map((board) => <TableRow key={board.id}><TableCell>{board.name}</TableCell><TableCell><Button asChild size="sm" variant="outline"><Link href={`${path}/boards/${board.id}`}>Open</Link></Button></TableCell></TableRow>)} />
    </SectionBlock> : null}
  </DashboardPage>
}
