import fontkit from "@pdf-lib/fontkit"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { PDFDocument, PDFFont, PDFPage, rgb } from "pdf-lib"
import pptxgen from "pptxgenjs"

type PdfSource = {
  source: string
  output: string
  title: string
}

const generatedDate = "2026-05-19"
const docsDir = path.join(process.cwd(), "docs")
const pdfDir = path.join(docsDir, "pdfs")
const presentationDir = path.join(docsDir, "presentations")
const pageSize: [number, number] = [595.28, 841.89]
const margin = 42
const contentWidth = pageSize[0] - margin * 2
const fontPath = "C:\\Windows\\Fonts\\malgun.ttf"
const boldFontPath = "C:\\Windows\\Fonts\\malgunbd.ttf"

const pdfSources: PdfSource[] = [
  {
    output: "information-architecture.pdf",
    source: "information-architecture.md",
    title: "YJIS LMS Information Architecture",
  },
  {
    output: "app-feature-spec.pdf",
    source: "app-feature-spec.md",
    title: "YJIS LMS 앱 기능 정의서",
  },
  {
    output: "screen-design-spec.pdf",
    source: "screen-design-spec.md",
    title: "YJIS LMS 화면 설계서",
  },
  {
    output: "database-design.pdf",
    source: "database-design.md",
    title: "YJIS LMS DB 설계도",
  },
]

void main()

async function main() {
  await mkdir(pdfDir, { recursive: true })
  await mkdir(presentationDir, { recursive: true })

  for (const source of pdfSources) {
    const markdown = await readFile(path.join(docsDir, source.source), "utf8")
    const pdfBytes = await markdownToPdf(source.title, markdown)
    await writeFile(path.join(pdfDir, source.output), pdfBytes)
    console.log(`Created docs/pdfs/${source.output}`)
  }

  await createIntroDeck(path.join(presentationDir, "yjis-lms-introduction.pptx"))
  console.log("Created docs/presentations/yjis-lms-introduction.pptx")
}

async function markdownToPdf(title: string, markdown: string) {
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const [regularBytes, boldBytes] = await Promise.all([
    readFile(fontPath),
    readFile(boldFontPath),
  ])
  const regular = await doc.embedFont(regularBytes, { subset: true })
  const bold = await doc.embedFont(boldBytes, { subset: true })
  const state = { page: doc.addPage(pageSize), y: pageSize[1] - margin }

  drawText(state.page, bold, title, 18, state.y)
  state.y -= 26
  drawText(state.page, regular, `Updated: ${generatedDate}`, 9, state.y, 0.45)
  state.y -= 18
  drawRule(state.page, state.y)
  state.y -= 24

  const inCodeBlock = { value: false }
  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trimEnd()
    if (line.startsWith("```")) {
      inCodeBlock.value = !inCodeBlock.value
      continue
    }

    if (!line.trim()) {
      state.y -= 8
      continue
    }

    const text = normalizeMarkdownLine(line)
    const level = headingLevel(line)
    const isTable = line.startsWith("|")
    const isBullet = line.startsWith("- ") || /^\d+\.\s/.test(line)
    const font = level || line.startsWith("#") ? bold : regular
    const size = level === 1 ? 16 : level === 2 ? 13 : level === 3 ? 11 : 9
    const prefix = isBullet ? "• " : isTable ? "" : ""
    const maxWidth = isTable ? contentWidth : contentWidth - (isBullet ? 14 : 0)

    ensureSpace(doc, state, size + 18)
    for (const wrapped of wrapText(`${prefix}${text}`, font, size, maxWidth)) {
      ensureSpace(doc, state, size + 16)
      drawText(state.page, font, wrapped, size, state.y, inCodeBlock.value ? 0.3 : 0.1)
      state.y -= size + 5
    }
    state.y -= level ? 8 : 3
  }

  doc.getPages().forEach((page, index) => {
    drawText(page, regular, `YJIS LMS | ${index + 1}`, 8, 24, 0.45)
  })

  return doc.save()
}

function normalizeMarkdownLine(line: string) {
  return line
    .replace(/^#{1,6}\s*/, "")
    .replace(/^\-\s*/, "")
    .replace(/^\d+\.\s*/, "")
    .replace(/\|/g, "  ")
    .replace(/`/g, "")
    .trim()
}

function headingLevel(line: string) {
  const match = /^(#{1,6})\s/.exec(line)
  return match?.[1].length ?? 0
}

function ensureSpace(
  doc: PDFDocument,
  state: { page: PDFPage; y: number },
  requiredHeight: number
) {
  if (state.y >= margin + requiredHeight) return
  state.page = doc.addPage(pageSize)
  state.y = pageSize[1] - margin
}

function drawText(
  page: PDFPage,
  font: PDFFont,
  text: string,
  size: number,
  y: number,
  shade = 0.1
) {
  page.drawText(text, {
    color: rgb(shade, shade + 0.02, shade + 0.06),
    font,
    size,
    x: margin,
    y,
  })
}

function drawRule(page: PDFPage, y: number) {
  page.drawLine({
    color: rgb(0.82, 0.85, 0.9),
    end: { x: pageSize[0] - margin, y },
    start: { x: margin, y },
    thickness: 1,
  })
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const lines: string[] = []
  let line = ""

  for (const char of text) {
    const next = `${line}${char}`
    if (font.widthOfTextAtSize(next, size) > maxWidth && line) {
      lines.push(line)
      line = char.trimStart()
    } else {
      line = next
    }
  }

  if (line) lines.push(line)
  return lines
}

async function createIntroDeck(outputPath: string) {
  const pptx = new pptxgen()
  pptx.layout = "LAYOUT_WIDE"
  pptx.author = "YJIS LMS"
  pptx.subject = "YJIS LMS product introduction"
  pptx.title = "YJIS LMS Introduction"
  pptx.company = "YJIS"
  pptx.theme = {
    headFontFace: "Malgun Gothic",
    bodyFontFace: "Malgun Gothic",
  }

  addCoverSlide(pptx)
  addPlatformSlide(pptx)
  addRoleSlide(pptx)
  addWorkflowSlide(pptx)
  addOperationsSlide(pptx)
  addDataSlide(pptx)
  addRoadmapSlide(pptx)

  await pptx.writeFile({ fileName: outputPath })
}

function addCoverSlide(pptx: pptxgen) {
  const slide = pptx.addSlide()
  slide.background = { color: "101827" }
  slide.addText("YJIS LMS", {
    bold: true,
    color: "FFFFFF",
    fontFace: "Malgun Gothic",
    fontSize: 42,
    h: 0.7,
    w: 7.6,
    x: 0.8,
    y: 1.25,
  })
  slide.addText("학교 운영, 학습 관리, 커뮤니케이션을 하나로 연결하는 로컬 우선 LMS", {
    color: "D6E4FF",
    fontSize: 18,
    h: 0.7,
    w: 9.2,
    x: 0.84,
    y: 2.1,
  })
  addMetric(slide, "5", "역할별 대시보드", 0.9, 4.3)
  addMetric(slide, "10+", "운영 모듈", 3.4, 4.3)
  addMetric(slide, "PDF", "리포트 카드 / 성적표", 5.9, 4.3)
  slide.addShape(pptx.ShapeType.arc, {
    h: 4.2,
    line: { color: "6EA8FE", transparency: 20, width: 2 },
    rotate: 18,
    w: 4.2,
    x: 8.5,
    y: 1.0,
  })
}

function addPlatformSlide(pptx: pptxgen) {
  const slide = baseSlide(pptx, "플랫폼 한 장 요약", "역할별 운영 화면과 학사 데이터를 하나의 흐름으로 연결")
  const items = [
    ["Admin", "학사 기준 데이터, 정책, 사용자, 게시판"],
    ["Instructor", "수업, 출석, 과제, 퀴즈, 성적"],
    ["Student", "학습, 제출, 결과 확인, 메시지"],
    ["Parent", "연결 학생 기록, 문서, 교사 메시지"],
  ]
  items.forEach(([title, body], index) => {
    addPanel(slide, title, body, 0.8 + index * 3.05, 2.0, 2.62, 2.7)
  })
  addFooter(slide, "권한은 서버 액션과 데이터 조회 단계에서 다시 검사됩니다.")
}

function addRoleSlide(pptx: pptxgen) {
  const slide = baseSlide(pptx, "역할별 가치", "각 계정 타입은 필요한 정보만 보도록 설계")
  const rows = [
    ["관리자", "설정과 감독", "조직/캠퍼스/정책/계정/문서"],
    ["강사", "수업 운영", "출석/과제/퀴즈/성적/게시판"],
    ["학생", "학습 실행", "수업/제출/퀴즈/결과/메시지"],
    ["학부모", "확인과 소통", "연결 학생 기록/문서/교사 메시지"],
  ]
  rows.forEach((row, index) => addRoleRow(slide, row, 1.0, 1.75 + index * 0.9))
}

function addWorkflowSlide(pptx: pptxgen) {
  const slide = baseSlide(pptx, "운영 흐름", "학사 셋업에서 성적 공개까지 끊기지 않는 MVP 플로우")
  const steps = [
    "학사 기준 설정",
    "반 개설",
    "수업 운영",
    "평가/채점",
    "성적 게시",
    "문서 발급",
  ]
  steps.forEach((step, index) => {
    const x = 0.75 + index * 1.98
    slide.addShape(pptx.ShapeType.roundRect, {
      fill: { color: index % 2 ? "EAF2FF" : "F7FAFC" },
      h: 1.25,
      line: { color: "BCD3F2" },
      w: 1.55,
      x,
      y: 2.7,
    })
    slide.addText(`${index + 1}`, {
      bold: true,
      color: "2563EB",
      fontSize: 16,
      h: 0.3,
      w: 0.4,
      x: x + 0.18,
      y: 2.9,
    })
    slide.addText(step, {
      color: "152238",
      fontSize: 11,
      h: 0.4,
      w: 1.1,
      x: x + 0.24,
      y: 3.32,
    })
  })
  addFooter(slide, "현재 성적은 모듈 비율 기반 MVP 흐름이며, 고급 gradebook 구조는 확장용으로 유지됩니다.")
}

function addOperationsSlide(pptx: pptxgen) {
  const slide = baseSlide(pptx, "운영 모듈", "학교 하루 운영에 필요한 핵심 기능을 우선 구현")
  const modules = [
    ["Attendance", "기본 Present, 전체 저장, 학생/학부모 알림"],
    ["Assignments", "제출, 첨부, 채점, 피드백"],
    ["Quizzes", "문항, 시도, 자동/수동 채점"],
    ["Boards", "공지, Q&A, 댓글, 이미지 첨부"],
    ["Messages", "텍스트 전용 DM, 반 그룹, 학부모-교사"],
    ["Notifications", "DB 기반 알림 센터와 읽음 상태"],
  ]
  modules.forEach(([title, body], index) => {
    const col = index % 3
    const row = Math.floor(index / 3)
    addPanel(slide, title, body, 0.8 + col * 4.05, 1.8 + row * 2.05, 3.45, 1.45)
  })
}

function addDataSlide(pptx: pptxgen) {
  const slide = baseSlide(pptx, "데이터 구조", "Organization과 ClassSection을 중심으로 학습 기록이 연결")
  const lanes = [
    ["학사 기준", "Organization, Campus, Course, ClassSection"],
    ["학습 기록", "Lesson, Attendance, Assignment, Quiz, Exam"],
    ["평가 결과", "FinalGrade, Transcript, ReportCard"],
    ["소통", "Board, Post, Comment, Conversation, Notification"],
  ]
  lanes.forEach(([title, body], index) => {
    slide.addShape(pptx.ShapeType.rect, {
      fill: { color: "F8FAFC" },
      h: 0.82,
      line: { color: "D9E2EC" },
      w: 10.9,
      x: 1.0,
      y: 1.65 + index * 1.05,
    })
    slide.addText(title, {
      bold: true,
      color: "0F172A",
      fontSize: 13,
      h: 0.3,
      w: 2.0,
      x: 1.25,
      y: 1.86 + index * 1.05,
    })
    slide.addText(body, {
      color: "334155",
      fontSize: 11,
      h: 0.3,
      w: 7.4,
      x: 3.3,
      y: 1.88 + index * 1.05,
    })
  })
}

function addRoadmapSlide(pptx: pptxgen) {
  const slide = baseSlide(pptx, "MVP 이후 확장", "현재 구조는 운영 안정성과 향후 확장을 모두 고려")
  const items = [
    ["자동화", "이메일, SMS, Push, Kakao 알림"],
    ["보안", "바이러스 스캔, 파일 쿼터, 업로드 감사"],
    ["분석", "출석/성적/학습 진도 리포트"],
    ["성적", "고급 GradeCategory / GradeItem workflow"],
  ]
  items.forEach(([title, body], index) => {
    addPanel(slide, title, body, 1.0 + (index % 2) * 5.8, 2.0 + Math.floor(index / 2) * 1.8, 4.85, 1.2)
  })
  addFooter(slide, "MVP는 로컬 운영, 권한 안정성, 학교 핵심 업무 흐름에 초점을 둡니다.")
}

function baseSlide(pptx: pptxgen, title: string, subtitle: string) {
  const slide = pptx.addSlide()
  slide.background = { color: "FFFFFF" }
  slide.addText(title, {
    bold: true,
    color: "0F172A",
    fontSize: 28,
    h: 0.5,
    w: 10.5,
    x: 0.72,
    y: 0.55,
  })
  slide.addText(subtitle, {
    color: "64748B",
    fontSize: 13,
    h: 0.35,
    w: 10.5,
    x: 0.75,
    y: 1.1,
  })
  slide.addShape(pptx.ShapeType.line, {
    h: 0,
    line: { color: "D7DFEA", width: 1 },
    w: 11.8,
    x: 0.75,
    y: 1.52,
  })
  return slide
}

function addPanel(
  slide: pptxgen.Slide,
  title: string,
  body: string,
  x: number,
  y: number,
  w: number,
  h: number
) {
  slide.addShape("roundRect", {
    fill: { color: "F8FAFC" },
    h,
    line: { color: "D9E2EC" },
    w,
    x,
    y,
  })
  slide.addText(title, {
    bold: true,
    color: "0F172A",
    fontSize: 14,
    h: 0.3,
    w: w - 0.35,
    x: x + 0.18,
    y: y + 0.18,
  })
  slide.addText(body, {
    color: "475569",
    fit: "shrink",
    fontSize: 10.5,
    h: h - 0.58,
    valign: "top",
    w: w - 0.35,
    x: x + 0.18,
    y: y + 0.55,
  })
}

function addMetric(
  slide: pptxgen.Slide,
  value: string,
  label: string,
  x: number,
  y: number
) {
  slide.addText(value, {
    bold: true,
    color: "FFFFFF",
    fontSize: 24,
    h: 0.4,
    w: 1.7,
    x,
    y,
  })
  slide.addText(label, {
    color: "B9D4FF",
    fontSize: 10,
    h: 0.3,
    w: 2.0,
    x,
    y: y + 0.5,
  })
}

function addRoleRow(slide: pptxgen.Slide, row: string[], x: number, y: number) {
  slide.addShape("roundRect", {
    fill: { color: "F8FAFC" },
    h: 0.64,
    line: { color: "D9E2EC" },
    w: 11.0,
    x,
    y,
  })
  slide.addText(row[0], {
    bold: true,
    color: "0F172A",
    fontSize: 12,
    h: 0.24,
    w: 2.1,
    x: x + 0.25,
    y: y + 0.2,
  })
  slide.addText(row[1], {
    color: "2563EB",
    fontSize: 11,
    h: 0.24,
    w: 2.3,
    x: x + 2.7,
    y: y + 0.2,
  })
  slide.addText(row[2], {
    color: "475569",
    fontSize: 10.5,
    h: 0.24,
    w: 5.4,
    x: x + 5.2,
    y: y + 0.2,
  })
}

function addFooter(slide: pptxgen.Slide, text: string) {
  slide.addText(text, {
    color: "64748B",
    fontSize: 9,
    h: 0.2,
    w: 11.5,
    x: 0.75,
    y: 6.75,
  })
}
