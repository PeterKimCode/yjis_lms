# GTCC YJIS LMS

학교의 수업·강의·출석·과제·시험·성적과 소통을 관리하는 LMS입니다. 처음 이용하는 분은 아래 PDF에서 본인 역할을 골라 따라 하세요.

**운영 서비스: [https://lms.mygtcc.com](https://lms.mygtcc.com)**
학교에서 받은 **Login ID와 비밀번호**로 로그인합니다. 공개 회원가입은 제공하지 않습니다. `http://localhost:3000`은 개발자가 자기 PC에서 실행할 때 사용하는 주소입니다.

## 쉬운 한국어 PDF 매뉴얼

A4 세로, 본문 16pt, 작업별 한 페이지로 구성했습니다. 최신 앱의 별도 데모 환경에서 캡처한 화면에 번호·테두리·화살표를 표시했습니다. 실제 개인정보나 비밀번호는 포함하지 않습니다. PDF 첫 페이지의 목차를 누르면 해당 작업으로 이동합니다.

| 대상 | PDF 열기·다운로드 | 주요 내용 | 쪽수 |
| --- | --- | --- | --- |
| 처음 이용하는 모든 사용자 | [처음 쓰는 LMS](docs/manuals/easy-start-guide.pdf) | 로그인, 모바일 메뉴, 메시지, 알림, 로그아웃 | 7 |
| Super Admin | [최고 관리자 매뉴얼](docs/manuals/super-admin-manual.pdf) | 조직·학년도, 사용자·과목·수업, 교수 배정, 학생 등록, 가족 연결 | 15 |
| School Admin | [학교 관리자 매뉴얼](docs/manuals/school-admin-manual.pdf) | 학교 범위 사용자 등록, 과목·수업, 교수 배정, 학생 등록, 권한 제한 | 12 |
| Academic Staff | [학사 직원 매뉴얼](docs/manuals/academic-staff-manual.pdf) | 허용 범위 사용자·수업·학생 관리, 가족 연결, 성적 서류 | 13 |
| Instructor | [교수 매뉴얼](docs/manuals/instructor-manual.pdf) | 강의·출석·과제, 임시 저장 복원, 시험/퀴즈·PDF 답안, 채점·성적 | 16 |
| Student | [학생 매뉴얼](docs/manuals/student-manual.pdf) | 오늘 할 일, 강의 진도, 과제 제출, PDF 시험 답안, 출석·성적 | 13 |
| Parent | [학부모 매뉴얼](docs/manuals/parent-manual.pdf) | 공개 시험 일정, 자녀 선택, 강의·출석·과제·성적 확인 | 12 |

화면의 영어 버튼 이름과 쉬운 한국어 설명을 함께 사용합니다. 화면 언어·학교 설정·권한에 따라 일부 메뉴가 다를 수 있습니다. [글로 읽는 공통 시작 안내](docs/user-guides/easy-start-guide.md)와 [매뉴얼 제작·재생성 안내](docs/manuals/README.md)도 제공합니다.

## 역할과 권한

현재 안내하는 역할은 다음 6개입니다. 접근 범위와 저장 권한은 서버에서도 검사합니다.

- **Super Admin:** 전체 조직·학교와 사용자·수업을 관리합니다.
- **School Admin:** 배정된 범위의 Instructor·Student·Parent 계정을 만들고 수업을 관리합니다. Super Admin이 조회 범위에 보이더라도 수정·삭제할 수 없습니다. 관리자 계정 변경과 사용자 삭제는 승인 절차를 따릅니다. 가족 연결과 학생 학사 상세·서류 관리 영역은 School Admin 전용 화면에 제공되지 않으므로 권한 있는 관리자에게 요청합니다.
- **Academic Staff:** 부여된 조직·캠퍼스 범위에서 사용자·과목·수업·학생 학사 기록과 가족 연결·서류 업무를 처리합니다. 범위 밖 자료와 Super Admin 계정 수정은 허용되지 않습니다.
- **Instructor:** 담당 수업의 강의·출석·과제·시험/퀴즈·채점·성적을 관리합니다.
- **Student:** 등록된 수업을 학습하고 과제와 시험 답안을 제출합니다.
- **Parent:** 연결된 자녀의 기록을 확인합니다. 자녀 대신 답안을 제출하거나 기록을 수정하지 않습니다.

기존 데이터 호환을 위한 `ORG_ADMIN`, `HOMEROOM_TEACHER` 값은 데이터 구조에 남아 있지만 Users 역할 탭에서는 표시하지 않습니다. 새 매뉴얼의 대상은 위 6개 역할입니다.

## 수업에서 자주 하는 일

`Classes → 수업 이름`으로 이동합니다. 기본 화면은 **Lessons**입니다.

| 수업 탭 | 내용 |
| --- | --- |
| Lessons | 강의 목록, 자료·영상, 학습 진도 |
| Attendance | 출석 확인·관리, 교수의 Sessions(수업 일정) |
| Assessments | Assignments(과제), Exams / Quiz(시험·퀴즈) |
| Grades | 성적, 교수의 평가 비중·성적 계산·공개 |
| Boards | 수업 게시판 |
| Students | 교수의 학생 목록 |
| Class conversation | 수업 단체 대화 |

학생·학부모 화면은 역할에 맞는 확인·제출 기능만 표시합니다. 모바일 탭은 가로로 밀어 이동합니다. 선택한 탭은 URL에 저장되어 새로고침·뒤로가기·공유 링크에서 복원됩니다.

### 강의와 영상

1. 교수는 `Lessons → Create lesson`에서 제목과 Text·Video·File 유형을 고릅니다.
2. 업로드 영상은 `Video source → Video: Upload`에서 파일을 선택합니다. **파일 선택 즉시 업로드가 시작**됩니다. 실패하면 `Retry upload`로 재시도합니다.
3. 업로드된 영상이 선택되었는지 확인한 뒤 강의를 저장합니다. **수동 Video duration 입력은 필요 없습니다.**
4. 학생은 실제로 영상 전체를 시청해야 완료됩니다. 건너뛴 구간은 시청으로 계산되지 않습니다. 글 강의는 열면 완료로 기록됩니다.
5. 교수는 공개 전환·완료 인원 버튼을 직접 사용하고 수정·복제·학생 미리보기는 더보기에서 엽니다. 손잡이를 끌어 강의 순서와 그룹을 변경하고 `Rename`으로 그룹 제목을 바꿉니다.

### 과제와 첨부파일

`Assessments → Assignments`에서 만듭니다. 제목·마감일·설명·PDF를 입력하고 `Save assignment`를 누릅니다. 과제 카드에 `Edit assignment`, `Review / Grade`, 첨부파일과 삭제 기능이 표시됩니다.

수정 화면의 기존 첨부파일에서 **View / Download / Replace / Delete**를 사용할 수 있습니다. 교체 업로드가 성공하기 전에는 기존 파일이 유지됩니다. 학생은 과제 화면에서 Text response 또는 파일을 제출하고, 교수는 점수·피드백을 저장합니다. 지각 제출·재제출·공개 여부는 과제 설정과 학교 정책에 따릅니다.

### Exams / Quiz

퀴즈와 시험은 하나의 작성·응시·채점 흐름으로 관리합니다. 교수와 학생은 같은 평가 데이터와 수업 내 일정을 사용합니다.

- `Create assessment`에서 **Quiz / Monthly exam / Midterm / Final exam / Other exam**을 고릅니다.
- 전용 편집 화면에서 제목·문제를 작성합니다. `Add multiple choice`, `Add open-ended`, `Add PDF answer sheet`로 필요한 문제만 추가합니다. 객관식 정답은 보기 옆에서 지정하고 `Done`으로 문제를 접습니다.
- **Assessment settings는 펼쳐진 상태**입니다. 학교 시간대로 시작·종료 시간, 제한 시간·응시 횟수·결과 공개 등을 확인합니다. 미구현 Shuffle questions는 표시하지 않으며 저장된 값은 보존합니다.
- 총점은 문제 배점 합계로 표시합니다. 기존 별도 만점 설정도 유지할 수 있습니다.
- **Save draft / Publish**를 구분합니다. 문제 없는 평가는 초안만 저장할 수 있고, 공개 전 문제·보기·정답을 검사합니다.
- PDF 시험은 시험지 첨부 후 답안란을 준비합니다. 학생은 시험지를 보거나 다운로드하고 **LMS 안의 답안란에 답을 써서 Submit answers**로 제출합니다.
- `Student preview`에서 학생 화면을 확인합니다. 목록의 `Edit / Grade`에서 수정·응시 내역·채점을 관리합니다. 시험 목록은 최신 작성순입니다.
- 작성·수정 저장 후 **Exams / Quiz 목록으로 돌아갑니다.** 작성 중에도 `Back to Exams / Quiz`를 사용할 수 있습니다. 저장 실패 시 입력을 유지하며 첨부 실패 여부와 재시도를 안내합니다.

### 모든 역할의 사용 흐름

- 사이드바 접기 상태는 계정별로 현재 브라우저에 유지됩니다. 모바일 메뉴는 별도로 열고 닫으며 접기 상태를 바꾸지 않습니다.
- 교수 강의·과제·시험/퀴즈의 생성·수정은 입력 1초 후 현재 기기에 임시 저장합니다. 다시 진입하면 `Restore / Discard`를 선택합니다. 사용자·수업·항목별로 구분하고, 7일 후 만료하며 성공적인 서버 저장이나 로그아웃 때 삭제합니다.
- 임시 저장은 서버 초안이나 학생 답안 저장이 아닙니다. 텍스트·설정·문제·보기·정답을 복원하지만 선택한 로컬 파일은 다시 선택해야 합니다. 업로드된 파일은 현재 선택 가능한 참조만 복원합니다. 브라우저 저장이 차단되면 안내하며 이탈 경고는 유지합니다.
- 학생 Overview의 `Your tasks`는 학교 날짜 기준 오늘, 이후 7일 이내, 마감 초과 미제출과 마감 없는 미완료 항목을 구분합니다. 공개된 시험과 등록 수업의 과제만 표시하며, 완료·재응시·종료 판정은 기존 규칙을 사용합니다. `Open`으로 해당 답안·제출 화면을 엽니다. Customize 배치는 그대로 유지됩니다.
- 학부모 Overview와 자녀 요약은 공개 시험만 표시합니다. 시작·종료 시간과 학교 시간대를 함께 표시하고, 결과 공개 설정을 따릅니다. 수동 채점 전 점수를 0점으로 표시하지 않습니다.
- 작은 화면의 주요 목록은 카드로 표시하고 복잡한 관리 표는 표 안에서 스크롤합니다. 생성·저장 버튼은 파란색, 취소·뒤로가기는 중립색 테두리, 삭제는 붉은색으로 통일했습니다.

### 학교 시간대와 성적 공개

평가 일정은 조직의 `timezone` 기준으로 입력·표시합니다. 미설정 시 `Asia/Seoul`을 사용합니다. 서버 저장 시점과 화면 표시 시간대를 구분하므로 여행 중인 사용자는 자기 휴대전화 시간 대신 화면의 학교 시간대를 확인해야 합니다. 학부모도 **자녀의 수업 → Exams / Quiz**에서 시작·종료 시간을 확인하세요.

최종 성적은 교수의 `Grades → Calculate final grades → Publish grades` 순서로 확인·공개합니다. 학생·학부모의 성적·피드백·결과·성적표 표시 여부는 학교 정책과 공개 상태에 따릅니다. Transcript(성적증명서)는 학교 승인 절차가 필요할 수 있습니다.

## 파일별 용량 제한

| 사용 위치 | 허용 종류 | 파일당 최대 |
| --- | --- | --- |
| 강의 영상 | MP4, WebM, MOV, M4V | 500MB |
| 과제·시험지 PDF | PDF | 20MB |
| 일반 자료·학생 과제 첨부 | PDF, Office 문서, TXT, 이미지, CSV, ZIP 등 허용 목록 | 20MB |
| 프로필 사진 | JPG, PNG, WEBP, GIF | 10MB |

실행파일·스크립트 등 허용되지 않은 파일은 차단됩니다. 동영상은 일반 자료 첨부 대신 영상 업로드 영역을 사용하세요. 업로드 중 창을 닫지 마세요.

## 메시지·알림·모바일

`Messages`에서 받는 사람을 고르고 대화를 시작하거나 기존 대화에서 `Send`로 글을 보냅니다. 내 메시지는 `Edit`로 **메시지 안에서 바로 수정**하며 `Save`로 저장합니다. 현재 메시지는 글만 전송합니다.

`Notifications`에서 알림을 확인하고 `Mark all as read`로 모두 읽음 처리합니다. 모바일에서는 위 `Menu` 또는 아래 `Home / Classes / Messages / Alerts`를 사용합니다. 이용을 마치면 `Logout`을 누릅니다.

## 개발 환경 실행

Node.js·npm, PostgreSQL, Redis, S3 호환 저장소(MinIO)가 필요합니다. 실제 연결 값은 별도 환경변수로 관리합니다. 운영 데이터로 데모 화면을 만들지 마세요.

```powershell
npm install
Copy-Item .env.example .env
# .env의 데이터베이스·파일 저장소·인증 설정을 개발 환경에 맞게 수정
npx prisma generate
npx prisma migrate deploy
npm run dev
```

개발 주소는 `http://localhost:3000`입니다. 초기 데모 데이터는 **분리된 개발 DB에서만** `npx tsx prisma/seed.ts`로 생성합니다. 배포·백업·보안 설정은 아래 문서를 참조하세요.

```powershell
npx tsc --noEmit
npm run lint
npm run build
```

- [배포 절차](docs/deployment.md): GitHub `main`에 푸시한 뒤 gmk에서 기존 **`deploy-lms`** 실행
- [운영·보안](docs/operations-and-security.md)
- [권한 설계](docs/permissions.md)
- [영상 업로드](docs/minio-video-upload.md)
- [PDF 서류 생성](docs/document-pdf-generation.md)

이번 README·매뉴얼 갱신은 **문서만 변경**하며 운영 앱 재배포가 필요하지 않습니다.

## 매뉴얼 다시 만들기

PDF 원문은 `docs/manuals/source/manuals.json`, 데모 캡처는 `docs/manuals/images`에 있습니다. 환경 준비와 검수 명령은 [재생성 안내](docs/manuals/README.md)에 정리했습니다.

```powershell
npx tsx scripts/generate-manual-pdfs.ts
```

이 명령은 문서 생성 전용 Python 스크립트를 실행하며 앱 DB·권한·기능을 변경하지 않습니다. PDF를 다시 생성한 뒤 반드시 전체 페이지를 렌더링하고 검수하세요.
