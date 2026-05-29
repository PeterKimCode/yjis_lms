import fontkit from "@pdf-lib/fontkit"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { PDFDocument, PDFFont, PDFPage, rgb } from "pdf-lib"

type ManualSection = {
  title: string
  intro?: string
  steps?: string[]
  notes?: string[]
}

type Manual = {
  fileName: string
  title: string
  subtitle: string
  sections: ManualSection[]
}

const outputDirectory = path.join(process.cwd(), "docs", "manuals")
const pageSize: [number, number] = [595.28, 841.89]
const margin = 44
const contentWidth = pageSize[0] - margin * 2
const generatedDate = "2026-05-29"
const fontPath = "C:\\Windows\\Fonts\\malgun.ttf"
const boldFontPath = "C:\\Windows\\Fonts\\malgunbd.ttf"

const navy = rgb(0.03, 0.07, 0.15)
const blue = rgb(0.08, 0.26, 0.62)
const lightBlue = rgb(0.9, 0.94, 1)
const border = rgb(0.78, 0.84, 0.92)
const muted = rgb(0.34, 0.42, 0.55)
const black = rgb(0.05, 0.07, 0.12)

const commonLoginSteps = [
  "인터넷 주소창에 http://localhost:3000 을 입력합니다.",
  "오른쪽 위의 Log In 버튼을 누릅니다.",
  "이메일과 비밀번호를 입력합니다. 테스트 비밀번호는 DemoPass123! 입니다.",
  "로그인 후 왼쪽 메뉴에서 필요한 기능을 선택합니다.",
]

const manuals: Manual[] = [
  {
    fileName: "easy-start-guide.pdf",
    title: "GTCC YJIS LMS 처음 쓰는 쉬운 설명서",
    subtitle: "계정 만들기부터 영상 레슨, 출석, 과제까지 한 번에 따라 하기",
    sections: [
      {
        title: "처음에는 이 순서만 따라 하세요",
        steps: [
          "관리자 계정으로 로그인합니다.",
          "Users에서 선생님, 학생, 학부모 계정을 만듭니다.",
          "Courses에서 과목을 만듭니다.",
          "Class Sections에서 실제 수업 반을 만듭니다.",
          "수업에 선생님과 학생을 연결합니다.",
          "선생님 계정으로 로그인해서 Lessons, Attendance, Assignments, Quizzes를 관리합니다.",
          "학생 계정으로 로그인해서 영상 시청과 과제 제출을 확인합니다.",
          "학부모 계정으로 로그인해서 자녀의 출석과 성적을 확인합니다.",
        ],
      },
      {
        title: "로그인",
        steps: commonLoginSteps,
      },
      {
        title: "사용자 만들기",
        intro: "학생, 선생님, 학부모 계정을 만드는 곳입니다.",
        steps: [
          "관리자 화면 왼쪽에서 Users를 누릅니다.",
          "Create user 영역을 찾습니다.",
          "Organization, Campus, Name, Email, Password, Role을 입력합니다.",
          "학생이라면 Student grade, Student homeroom, Student number도 입력합니다.",
          "Save를 누릅니다.",
        ],
        notes: ["같은 이메일은 두 번 만들 수 없습니다. 이미 있는 이메일이면 기존 사용자를 수정하세요."],
      },
      {
        title: "과목과 수업 만들기",
        steps: [
          "Courses 메뉴에서 과목을 먼저 만듭니다.",
          "Class Sections 메뉴로 이동합니다.",
          "Course를 먼저 선택합니다.",
          "수업 이름, 정원, 기간, 담당 선생님, 학생을 입력하거나 연결합니다.",
          "Save를 누릅니다.",
        ],
        notes: ["Capacity는 수업 정원입니다. 예: 30명을 받을 수 있으면 30을 입력합니다."],
      },
      {
        title: "영상 레슨 만들기",
        steps: [
          "선생님 계정으로 로그인합니다.",
          "Classes에서 수업을 엽니다.",
          "Lessons 섹션에서 Create lesson을 엽니다.",
          "Title을 입력하고 Type은 VIDEO를 선택합니다.",
          "YouTube 또는 HTML5 영상을 설정합니다.",
          "학생에게 보이게 하려면 Published를 체크합니다.",
          "Save를 누릅니다.",
        ],
      },
      {
        title: "출석, 과제, 퀴즈",
        steps: [
          "Attendance에서는 Manage attendance를 열고 출석을 저장합니다. 기본값은 Present입니다.",
          "Assignments에서는 과제를 만들고 Review submissions에서 제출물을 확인합니다.",
          "Quizzes에서는 퀴즈를 만들고 Manage에서 문제를 추가합니다.",
          "Grades에서는 최종 성적을 계산하고 공개합니다.",
        ],
      },
    ],
  },
  {
    fileName: "super-admin-manual.pdf",
    title: "Super Admin 쉬운 설명서",
    subtitle: "전체 학교, 조직, 캠퍼스, 정책을 관리하는 계정",
    sections: [
      { title: "로그인", steps: commonLoginSteps },
      {
        title: "Organization 만들기",
        steps: [
          "왼쪽 메뉴에서 Academic setup을 엽니다.",
          "Organizations를 누릅니다.",
          "Create organization에서 학교 이름을 입력합니다.",
          "필요하면 로고 이미지를 올립니다.",
          "Save를 누릅니다.",
        ],
      },
      {
        title: "Campus 만들기",
        steps: [
          "Academic setup 안에서 Campuses를 누릅니다.",
          "Organization을 선택합니다.",
          "Campus 이름을 입력합니다.",
          "Save를 누릅니다.",
        ],
        notes: ["새 캠퍼스를 만들면 기본 정책과 기본 성적 등급표가 자동으로 준비됩니다."],
      },
      {
        title: "정책 확인",
        steps: [
          "Policies 메뉴를 누릅니다.",
          "Organization 또는 Campus 범위를 선택합니다.",
          "출석, 영상 완료 기준, 과제, 성적 공개, 문서 공개 정책을 확인합니다.",
          "필요한 값을 바꾸고 Save를 누릅니다.",
        ],
      },
    ],
  },
  {
    fileName: "school-admin-manual.pdf",
    title: "School Admin 쉬운 설명서",
    subtitle: "사용자, 과목, 수업, 학생 연결을 관리하는 계정",
    sections: [
      { title: "로그인", steps: commonLoginSteps },
      {
        title: "학생 또는 선생님 계정 만들기",
        steps: [
          "Users 메뉴를 누릅니다.",
          "Create user 영역을 찾습니다.",
          "이름, 이메일, 비밀번호, 역할을 입력합니다.",
          "학생은 학년, 반, 학생 번호를 입력합니다.",
          "Save를 누릅니다.",
        ],
      },
      {
        title: "과목 만들기",
        steps: [
          "Courses 메뉴를 누릅니다.",
          "과목 이름과 과목 코드를 입력합니다.",
          "학점이 있으면 credits를 입력합니다.",
          "Save를 누릅니다.",
        ],
      },
      {
        title: "수업 만들기",
        steps: [
          "Class Sections 메뉴를 누릅니다.",
          "Course를 먼저 선택합니다.",
          "수업 이름, 정원, 기간을 입력합니다.",
          "담당 선생님과 학생을 연결합니다.",
          "Save를 누릅니다.",
        ],
      },
      {
        title: "학생 기록 확인",
        steps: [
          "Users에서 학생 이름을 엽니다.",
          "Enrolled classes에서 View class record를 누릅니다.",
          "해당 수업의 출석, 레슨 진행률, 과제, 퀴즈, 성적을 확인합니다.",
        ],
      },
    ],
  },
  {
    fileName: "instructor-manual.pdf",
    title: "Instructor 쉬운 설명서",
    subtitle: "수업 운영, 영상 레슨, 출석, 과제, 퀴즈, 성적 관리",
    sections: [
      { title: "로그인", steps: commonLoginSteps },
      {
        title: "내 수업 열기",
        steps: [
          "왼쪽 메뉴에서 Classes를 누릅니다.",
          "수업 목록에서 원하는 수업 이름을 누릅니다.",
          "Lessons, Sessions, Attendance, Assignments, Quizzes, Grades 섹션을 확인합니다.",
        ],
      },
      {
        title: "영상 레슨 만들기",
        steps: [
          "Lessons 섹션에서 Create lesson을 엽니다.",
          "Title을 입력합니다.",
          "Type은 VIDEO를 선택합니다.",
          "YouTube 또는 HTML5 영상 정보를 입력합니다.",
          "Published를 체크하면 학생에게 보입니다.",
          "Save를 누릅니다.",
        ],
      },
      {
        title: "출석 체크하기",
        steps: [
          "Attendance 섹션에서 Manage attendance를 엽니다.",
          "기본값은 PRESENT입니다.",
          "결석이나 지각 학생만 상태를 바꿉니다.",
          "전체 저장 버튼으로 한 번에 저장합니다.",
        ],
        notes: ["출석이 바뀌면 학생과 학부모에게 알림이 갑니다."],
      },
      {
        title: "과제와 채점",
        steps: [
          "Assignments 섹션에서 Create assignment를 엽니다.",
          "제목, 마감일, 만점 점수를 입력합니다.",
          "학생 제출은 Review submissions에서 확인합니다.",
          "점수와 피드백을 입력하고 Save grade를 누릅니다.",
        ],
      },
      {
        title: "퀴즈 만들기",
        steps: [
          "Quizzes 섹션에서 퀴즈를 만듭니다.",
          "퀴즈 목록에서 Manage를 누릅니다.",
          "Add question에서 문제를 추가합니다.",
          "객관식, 참/거짓은 자동 채점되고 서술형은 직접 채점합니다.",
        ],
      },
    ],
  },
  {
    fileName: "student-manual.pdf",
    title: "Student 쉬운 설명서",
    subtitle: "수업 보기, 영상 시청, 과제 제출, 퀴즈 응시",
    sections: [
      { title: "로그인", steps: commonLoginSteps },
      {
        title: "내 수업 열기",
        steps: [
          "왼쪽 메뉴에서 Classes를 누릅니다.",
          "수업 이름을 누릅니다.",
          "Lessons, Assignments, Quizzes, Grades를 확인합니다.",
        ],
      },
      {
        title: "영상 보기",
        steps: [
          "Lessons 섹션에서 원하는 레슨의 Open을 누릅니다.",
          "영상을 끝까지 봅니다.",
          "진행률이 100%가 되면 완료로 표시됩니다.",
        ],
      },
      {
        title: "과제 제출",
        steps: [
          "Assignments 섹션에서 과제를 확인합니다.",
          "답변을 입력합니다.",
          "필요하면 허용된 파일을 첨부합니다.",
          "Submit 또는 Update submission을 누릅니다.",
        ],
      },
      {
        title: "메시지와 알림",
        steps: [
          "Messages에서 같은 수업의 선생님에게 메시지를 보낼 수 있습니다.",
          "Notifications에서 새 과제, 새 메시지, 성적 공개 알림을 확인합니다.",
        ],
      },
      {
        title: "성적표와 Transcript",
        steps: [
          "공개된 성적만 볼 수 있습니다.",
          "Download transcript는 하루 최대 3회까지 가능합니다.",
        ],
      },
    ],
  },
  {
    fileName: "parent-manual.pdf",
    title: "Parent 쉬운 설명서",
    subtitle: "자녀 수업, 출석, 과제, 성적 확인",
    sections: [
      { title: "로그인", steps: commonLoginSteps },
      {
        title: "자녀 정보 보기",
        steps: [
          "Parent dashboard에서 연결된 학생 이름을 확인합니다.",
          "자녀의 수업 목록을 엽니다.",
          "출석, 과제, 퀴즈, 성적 상태를 확인합니다.",
        ],
      },
      {
        title: "선생님에게 메시지 보내기",
        steps: [
          "Messages 또는 자녀 수업 화면에서 Message teacher를 누릅니다.",
          "내용을 입력합니다.",
          "Send를 누릅니다.",
        ],
      },
      {
        title: "성적과 문서",
        steps: [
          "성적은 학교가 공개한 뒤에만 보입니다.",
          "Report card와 Transcript는 공개된 성적 기준으로 다운로드할 수 있습니다.",
        ],
      },
    ],
  },
]

class PdfWriter {
  private page: PDFPage
  private y = pageSize[1] - margin
  private pageNumber = 0

  constructor(
    private readonly doc: PDFDocument,
    private readonly regular: PDFFont,
    private readonly bold: PDFFont,
    private readonly manualTitle: string,
  ) {
    this.page = this.addPage()
  }

  title(title: string, subtitle: string) {
    this.drawText(title, this.bold, 22, navy, 26)
    this.drawText(subtitle, this.regular, 11, muted, 18)
    this.y -= 10
    this.drawLine()
  }

  section(section: ManualSection) {
    this.ensureSpace(80)
    this.drawText(section.title, this.bold, 15, blue, 22)

    if (section.intro) {
      this.drawText(section.intro, this.regular, 10.5, muted, 17)
      this.y -= 4
    }

    if (section.steps?.length) {
      this.drawStepBox(section.steps)
    }

    if (section.notes?.length) {
      this.drawNoteBox(section.notes)
    }

    this.y -= 8
  }

  private addPage() {
    const page = this.doc.addPage(pageSize)
    this.pageNumber += 1
    page.drawText("GTCC YJIS LMS", {
      x: margin,
      y: 24,
      size: 8,
      font: this.bold,
      color: muted,
    })
    page.drawText(`${this.manualTitle} · ${generatedDate} · ${this.pageNumber}`, {
      x: pageSize[0] - margin - 190,
      y: 24,
      size: 8,
      font: this.regular,
      color: muted,
    })
    return page
  }

  private drawLine() {
    this.page.drawLine({
      start: { x: margin, y: this.y },
      end: { x: pageSize[0] - margin, y: this.y },
      thickness: 1,
      color: border,
    })
    this.y -= 18
  }

  private drawStepBox(steps: string[]) {
    const startY = this.y
    const lines = steps.flatMap((step, index) => this.wrapText(`${index + 1}. ${step}`, this.regular, 10.5, contentWidth - 28))
    const boxHeight = lines.length * 17 + 22
    this.ensureSpace(boxHeight + 12)

    const actualStartY = this.y
    this.page.drawRectangle({
      x: margin,
      y: actualStartY - boxHeight + 8,
      width: contentWidth,
      height: boxHeight,
      borderColor: border,
      borderWidth: 1,
      color: rgb(0.98, 0.99, 1),
    })

    let lineY = actualStartY - 12
    for (const line of lines) {
      this.page.drawText(line, {
        x: margin + 14,
        y: lineY,
        size: 10.5,
        font: this.regular,
        color: black,
      })
      lineY -= 17
    }

    this.y = actualStartY - boxHeight - 4

    if (startY !== actualStartY) {
      this.y -= 2
    }
  }

  private drawNoteBox(notes: string[]) {
    const lines = notes.flatMap((note) => this.wrapText(`참고: ${note}`, this.regular, 9.5, contentWidth - 26))
    const boxHeight = lines.length * 15 + 18
    this.ensureSpace(boxHeight + 10)
    this.page.drawRectangle({
      x: margin,
      y: this.y - boxHeight + 7,
      width: contentWidth,
      height: boxHeight,
      borderColor: rgb(0.7, 0.82, 1),
      borderWidth: 1,
      color: lightBlue,
    })

    let lineY = this.y - 11
    for (const line of lines) {
      this.page.drawText(line, {
        x: margin + 13,
        y: lineY,
        size: 9.5,
        font: this.regular,
        color: blue,
      })
      lineY -= 15
    }
    this.y -= boxHeight + 4
  }

  private drawText(text: string, font: PDFFont, size: number, color: ReturnType<typeof rgb>, lineHeight: number) {
    const lines = this.wrapText(text, font, size, contentWidth)
    this.ensureSpace(lines.length * lineHeight + 8)
    for (const line of lines) {
      this.page.drawText(line, { x: margin, y: this.y, size, font, color })
      this.y -= lineHeight
    }
  }

  private ensureSpace(requiredHeight: number) {
    if (this.y - requiredHeight > 54) return
    this.page = this.addPage()
    this.y = pageSize[1] - margin
  }

  private wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
    const words = text.split(" ")
    const lines: string[] = []
    let current = ""

    for (const word of words) {
      const next = current ? `${current} ${word}` : word
      if (font.widthOfTextAtSize(next, size) <= maxWidth) {
        current = next
        continue
      }

      if (current) lines.push(current)

      if (font.widthOfTextAtSize(word, size) <= maxWidth) {
        current = word
      } else {
        const chunks = this.breakLongWord(word, font, size, maxWidth)
        lines.push(...chunks.slice(0, -1))
        current = chunks[chunks.length - 1] ?? ""
      }
    }

    if (current) lines.push(current)
    return lines
  }

  private breakLongWord(word: string, font: PDFFont, size: number, maxWidth: number) {
    const chunks: string[] = []
    let current = ""
    for (const char of Array.from(word)) {
      const next = `${current}${char}`
      if (font.widthOfTextAtSize(next, size) <= maxWidth) {
        current = next
      } else {
        if (current) chunks.push(current)
        current = char
      }
    }
    if (current) chunks.push(current)
    return chunks
  }
}

async function createManual(manual: Manual, regularBytes: Uint8Array, boldBytes: Uint8Array) {
  const pdfDoc = await PDFDocument.create()
  pdfDoc.registerFontkit(fontkit)

  const regular = await pdfDoc.embedFont(regularBytes)
  const bold = await pdfDoc.embedFont(boldBytes)
  const writer = new PdfWriter(pdfDoc, regular, bold, manual.title)

  writer.title(manual.title, manual.subtitle)
  for (const section of manual.sections) {
    writer.section(section)
  }

  const bytes = await pdfDoc.save()
  await writeFile(path.join(outputDirectory, manual.fileName), bytes)
}

async function main() {
  await mkdir(outputDirectory, { recursive: true })

  const [regularBytes, boldBytes] = await Promise.all([readFile(fontPath), readFile(boldFontPath)])

  for (const manual of manuals) {
    await createManual(manual, regularBytes, boldBytes)
    console.log(`Generated ${manual.fileName}`)
  }
}

main().catch((error) => {
  console.error("Manual PDF generation failed", error)
  process.exit(1)
})
