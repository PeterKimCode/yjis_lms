import fontkit from "@pdf-lib/fontkit"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { PDFDocument, PDFFont, PDFPage, rgb } from "pdf-lib"

type ManualSection = {
  title: string
  bullets: string[]
}

type Manual = {
  audience: string
  fileName: string
  role: string
  sections: ManualSection[]
}

const outputDirectory = path.join(process.cwd(), "docs", "manuals")
const pageSize: [number, number] = [595.28, 841.89]
const margin = 42
const contentWidth = pageSize[0] - margin * 2
const bodyLineHeight = 16
const generatedDate = "2026-05-19"
const fontPath = "C:\\Windows\\Fonts\\malgun.ttf"
const boldFontPath = "C:\\Windows\\Fonts\\malgunbd.ttf"

const manuals: Manual[] = [
  {
    audience: "플랫폼 전체 운영자 및 최고 관리자",
    fileName: "super-admin-manual.pdf",
    role: "Super Admin",
    sections: [
      {
        title: "주요 역할",
        bullets: [
          "조직, 캠퍼스, 사용자, 역할, 강좌, 반, 정책, 게시판을 전체 범위에서 관리합니다.",
          "관리자 대시보드에서 메시지, 알림, 최근 운영 항목을 확인합니다.",
          "학교 전체 설정을 바꾸기 전에는 영향 범위를 확인하고 필요한 경우 캠퍼스 관리자와 공유합니다.",
        ],
      },
      {
        title: "자주 사용하는 메뉴",
        bullets: [
          "Users: 계정, 학생 배치, 학부모 연결, 학생별 학업 기록을 확인합니다.",
          "Class Sections: 반별 강사, 학생, 수업 운영 상태를 확인합니다.",
          "Policies: 출석, 영상 완료, 과제, 성적 공개, 문서, GPA, 등급표 정책을 설정합니다.",
          "Boards, Messages, Notifications: 학교 공지와 커뮤니케이션 상태를 관리합니다.",
        ],
      },
      {
        title: "성적과 문서",
        bullets: [
          "최종 성적은 초안 상태에서는 학생과 학부모에게 보이지 않습니다.",
          "성적이 게시 또는 확정되면 학생과 연결된 학부모가 성적과 문서를 확인할 수 있습니다.",
          "리포트 카드와 성적표 PDF는 학생 상세 페이지 또는 문서 메뉴에서 생성합니다.",
        ],
      },
      {
        title: "주의사항",
        bullets: [
          "데모 계정은 로컬 개발용입니다. 실제 운영 비밀번호로 사용하지 마세요.",
          ".env와 .env.local은 커밋하지 않습니다.",
          "관리자 권한 부여 전에는 사용자 소속과 역할을 반드시 확인합니다.",
        ],
      },
    ],
  },
  {
    audience: "학교 또는 캠퍼스 단위 관리자",
    fileName: "school-admin-manual.pdf",
    role: "School Admin / Academic Staff",
    sections: [
      {
        title: "주요 역할",
        bullets: [
          "자신의 학교 또는 캠퍼스 범위 안에서 사용자, 강좌, 반, 정책, 게시판을 관리합니다.",
          "학생 상세 페이지에서 학생의 반 목록과 학부모 연결 상태를 확인합니다.",
          "학생의 특정 반 기록은 학생 상세 페이지의 View class record 링크에서 확인합니다.",
        ],
      },
      {
        title: "운영 흐름",
        bullets: [
          "학기 시작 전 캠퍼스 정책과 등급표가 준비되어 있는지 확인합니다.",
          "강좌와 반을 만들고 담당 강사와 학생 등록 상태를 점검합니다.",
          "공지 게시판과 메시지를 통해 학교 또는 반 단위 커뮤니케이션을 운영합니다.",
        ],
      },
      {
        title: "문서와 공개",
        bullets: [
          "성적이 게시 또는 확정된 뒤 학생과 학부모에게 문서를 공개합니다.",
          "관리자는 범위 안에서 초안 문서를 미리 볼 수 있습니다.",
          "초안 성적을 공개해야 하는 경우 정책 설정과 학교 운영 기준을 먼저 확인합니다.",
        ],
      },
    ],
  },
  {
    audience: "담당 반을 운영하는 강사 또는 담임",
    fileName: "instructor-manual.pdf",
    role: "Instructor",
    sections: [
      {
        title: "대시보드",
        bullets: [
          "Instructor 대시보드에서 담당 반, 메시지, 알림을 확인합니다.",
          "읽지 않은 메시지와 알림은 배지로 표시됩니다.",
          "담당 반을 열면 수업 운영 기능을 한 화면에서 관리할 수 있습니다.",
        ],
      },
      {
        title: "반 운영",
        bullets: [
          "Lessons에서 수업 자료와 영상 학습을 관리합니다.",
          "Sessions에서 수업 일정을 만들고 Attendance에서 출석을 기록합니다.",
          "Assignments에서 과제를 만들고 제출물을 검토하며 점수와 피드백을 입력합니다.",
          "Quizzes에서 퀴즈를 만들고 전용 관리 화면에서 문제와 시도를 관리합니다.",
        ],
      },
      {
        title: "성적",
        bullets: [
          "Grades에서 Lessons, Attendance, Assignments, Quizzes, Exams 비율을 설정합니다.",
          "Calculate final grades를 실행하면 학생별 최종 점수가 계산됩니다.",
          "Publish final grades 후 학생과 학부모가 공개된 성적을 볼 수 있습니다.",
        ],
      },
      {
        title: "커뮤니케이션",
        bullets: [
          "Messages는 텍스트 전용 1:1, 반 그룹, 학부모-교사 대화에 사용합니다.",
          "Boards는 공지, Q&A, 자료 공유에 사용합니다.",
          "게시판에는 이미지 첨부가 가능하지만 메시지에는 파일 첨부가 없습니다.",
        ],
      },
    ],
  },
  {
    audience: "수업을 수강하는 학생",
    fileName: "student-manual.pdf",
    role: "Student",
    sections: [
      {
        title: "대시보드",
        bullets: [
          "Student 대시보드에서 수강 반, 메시지, 알림, 문서를 확인합니다.",
          "읽지 않은 메시지와 알림은 화면 상단과 대시보드에 표시됩니다.",
          "문서는 공개된 성적이 있을 때 표시됩니다.",
        ],
      },
      {
        title: "학습 활동",
        bullets: [
          "반 상세 화면에서 수업, 출석, 과제, 퀴즈, 게시판, 공개 성적을 확인합니다.",
          "과제는 텍스트 답변과 허용된 첨부파일로 제출할 수 있습니다.",
          "퀴즈는 공개 기간과 시도 횟수 안에서 시작하고 제출합니다.",
          "영상 수업은 학교의 영상 완료 정책 기준에 따라 완료 처리됩니다.",
        ],
      },
      {
        title: "커뮤니케이션",
        bullets: [
          "Messages에서 수강 중인 반의 선생님에게 메시지를 보낼 수 있습니다.",
          "학생끼리의 직접 메시지는 MVP에서 비활성화되어 있습니다.",
          "게시판은 권한이 허용된 경우에만 글쓰기 또는 댓글 작성이 가능합니다.",
        ],
      },
    ],
  },
  {
    audience: "학생과 연결된 학부모 또는 보호자",
    fileName: "parent-manual.pdf",
    role: "Parent",
    sections: [
      {
        title: "대시보드",
        bullets: [
          "Parent 대시보드에서 연결된 학생, 메시지, 알림을 확인합니다.",
          "연결되지 않은 학생의 정보는 볼 수 없습니다.",
          "학생별 반, 과제, 퀴즈, 공개 성적, 문서를 확인할 수 있습니다.",
        ],
      },
      {
        title: "학생 기록 확인",
        bullets: [
          "출석, 과제 제출 상태, 퀴즈 결과, 최종 성적은 학교 공개 정책에 따라 표시됩니다.",
          "학부모는 과제를 제출하거나 퀴즈를 응시하거나 학생 기록을 수정할 수 없습니다.",
          "초안 성적과 초안 문서는 기본적으로 숨겨집니다.",
        ],
      },
      {
        title: "커뮤니케이션",
        bullets: [
          "Messages에서 연결된 학생의 담당 선생님에게 연락할 수 있습니다.",
          "학부모 게시판 글쓰기와 댓글은 게시판 권한이 허용된 경우에만 가능합니다.",
          "다른 학생이나 연결되지 않은 반의 게시판에는 접근할 수 없습니다.",
        ],
      },
    ],
  },
]

void main()

async function main() {
  await mkdir(outputDirectory, { recursive: true })

  for (const manual of manuals) {
    const bytes = await createManualPdf(manual)
    await writeFile(path.join(outputDirectory, manual.fileName), bytes)
    console.log(`Created docs/manuals/${manual.fileName}`)
  }
}

async function createManualPdf(manual: Manual) {
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)

  const [regularBytes, boldBytes] = await Promise.all([
    readFile(fontPath),
    readFile(boldFontPath),
  ])
  const regular = await doc.embedFont(regularBytes, { subset: true })
  const bold = await doc.embedFont(boldBytes, { subset: true })

  const state = {
    page: doc.addPage(pageSize),
    y: pageSize[1] - margin,
  }

  drawText(state.page, bold, `YJIS LMS ${manual.role} 설명서`, 20, state.y)
  state.y -= 28
  drawText(state.page, regular, manual.audience, 10, state.y, 0.38)
  state.y -= 18
  drawText(state.page, regular, `생성일: ${generatedDate}`, 9, state.y, 0.45)
  state.y -= 18
  drawRule(state.page, state.y)
  state.y -= 26

  for (const section of manual.sections) {
    ensureSpace(doc, state, 110)
    drawText(state.page, bold, section.title, 13, state.y)
    state.y -= 22

    for (const bullet of section.bullets) {
      const wrapped = wrapText(bullet, regular, 10, contentWidth - 18)
      for (let index = 0; index < wrapped.length; index += 1) {
        ensureSpace(doc, state, 42)
        const prefix = index === 0 ? "• " : "  "
        drawText(state.page, regular, `${prefix}${wrapped[index]}`, 10, state.y)
        state.y -= bodyLineHeight
      }
      state.y -= 4
    }

    state.y -= 14
  }

  doc.getPages().forEach((page, index) => {
    drawText(
      page,
      regular,
      `YJIS LMS | ${manual.role} | ${index + 1}`,
      8,
      24,
      0.45
    )
  })

  return doc.save()
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
    x: margin,
    y,
    size,
    font,
    color: rgb(shade, shade + 0.02, shade + 0.06),
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
