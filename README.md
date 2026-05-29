# GTCC YJIS LMS 쉬운 사용 설명서

이 문서는 컴퓨터가 익숙하지 않은 분도 LMS를 사용할 수 있도록 아주 천천히 설명합니다.
어려운 말보다 “어느 메뉴를 누르고, 무엇을 입력하고, 어떤 버튼을 누르는지”를 중심으로 적었습니다.

## 1. 먼저 이것만 기억하세요

1. 인터넷 주소창에 `http://localhost:3000`을 입력합니다.
2. 오른쪽 위 또는 화면의 `Log In` 버튼을 누릅니다.
3. 이메일과 비밀번호를 입력합니다.
4. 로그인 후 왼쪽 메뉴에서 필요한 일을 선택합니다.
5. 새로 만든 뒤에는 보통 `Save` 버튼을 눌러 저장합니다.

## 2. 테스트 계정

모든 테스트 계정의 비밀번호는 `DemoPass123!` 입니다.

| 역할 | 이메일 | 주로 하는 일 |
| --- | --- | --- |
| Super Admin | `super.admin@demo.local` | 전체 학교/조직 관리 |
| School Admin | `school.admin@demo.local` | 사용자, 수업, 학사 설정 관리 |
| Instructor | `instructor@demo.local` | 레슨, 출석, 과제, 퀴즈, 성적 관리 |
| Student | `student@demo.local` | 수업 보기, 영상 보기, 과제 제출 |
| Parent | `parent@demo.local` | 자녀 수업, 출석, 성적 확인 |

## 3. 가장 많이 쓰는 순서

처음 학교를 세팅할 때는 보통 아래 순서대로 하면 됩니다.

1. 관리자 계정으로 로그인합니다.
2. `Users`에서 선생님, 학생, 학부모 계정을 만듭니다.
3. `Courses`에서 과목을 만듭니다.
4. `Class Sections`에서 실제 반/수업을 만듭니다.
5. 수업에 선생님과 학생을 연결합니다.
6. 선생님 계정으로 로그인합니다.
7. `Classes`에서 수업을 열고 영상 레슨, 출석, 과제, 퀴즈를 만듭니다.
8. 학생 계정으로 로그인해서 영상 시청, 과제 제출, 퀴즈 응시를 확인합니다.
9. 학부모 계정으로 로그인해서 자녀 기록을 확인합니다.

## 4. 사용자 만들기

관리자가 학생, 선생님, 학부모 계정을 만드는 방법입니다.

1. 관리자 계정으로 로그인합니다.
2. 왼쪽 메뉴에서 `Users`를 누릅니다.
3. `Create user` 또는 사용자 생성 영역을 찾습니다.
4. 아래 내용을 입력합니다.
   - `Organization`: 학교 또는 조직
   - `Campus`: 캠퍼스
   - `Name`: 이름
   - `Email`: 로그인할 이메일
   - `Password`: 임시 비밀번호
   - `Role`: 역할
5. 학생이라면 `Student grade`, `Student homeroom`, `Student number`도 입력합니다.
6. `Save` 버튼을 누릅니다.

중요: 같은 이메일은 두 번 만들 수 없습니다. 이미 있는 이메일이면 다른 이메일을 사용하거나 기존 사용자를 수정하세요.

## 5. 과목 만들기

과목은 “영어”, “수학”, “Introduction to Learning” 같은 큰 이름입니다.

1. 관리자 계정으로 로그인합니다.
2. 왼쪽 메뉴에서 `Courses`를 누릅니다.
3. `Create course` 영역을 찾습니다.
4. 과목 이름, 코드, 학점이 있으면 입력합니다.
5. `Save`를 누릅니다.

## 6. 수업 만들기

수업은 실제 학생들이 들어가는 반입니다. 예: `Introduction to Learning - Section A`

1. 관리자 계정으로 로그인합니다.
2. 왼쪽 메뉴에서 `Class Sections`를 누릅니다.
3. `Create class section` 영역을 찾습니다.
4. `Course`를 먼저 선택합니다.
5. Course를 선택하면 가능한 조직/캠퍼스 정보가 맞게 채워집니다.
6. 수업 제목, 정원, 기간, 강의 방식을 입력합니다.
7. 담당 선생님과 학생을 연결합니다.
8. `Save`를 누릅니다.

참고: `Capacity`는 수업 정원입니다. 예를 들어 30명을 받을 수 있으면 `30`을 입력합니다.

## 7. 영상 레슨 만들기

선생님이 학생에게 보여줄 동영상 수업을 만드는 방법입니다.

1. 선생님 계정으로 로그인합니다.
2. 왼쪽 메뉴에서 `Classes`를 누릅니다.
3. 원하는 수업 이름을 누릅니다.
4. 화면에서 `Lessons` 섹션을 찾습니다.
5. `Create lesson`을 엽니다.
6. 아래 내용을 입력합니다.
   - `Title`: 레슨 제목
   - `Type`: `VIDEO`
   - `Video provider`: YouTube 또는 HTML5
   - `Duration`: 영상 길이
   - `Published`: 학생에게 보이게 하려면 체크
7. `Save`를 누릅니다.

학생 화면에서는 `Open` 버튼 옆에 시청 진행률이 보입니다.
100%가 아니면 빨간색으로 보이고, 완료되면 초록색 100%와 체크 표시가 보입니다.

## 8. 출석 체크하기

선생님이 한 번에 출석을 저장하는 방법입니다.

1. 선생님 계정으로 로그인합니다.
2. `Classes`에서 수업을 엽니다.
3. `Attendance` 섹션을 찾습니다.
4. `Manage attendance`를 엽니다.
5. 기본 상태는 `PRESENT`입니다.
6. 결석이나 지각 학생만 상태를 바꿉니다.
7. 한 명씩 저장할 수도 있고, 전체 저장 버튼으로 한 번에 저장할 수 있습니다.

출석이 바뀌면 학생과 연결된 학부모에게 알림이 갑니다.

## 9. 과제 만들기와 채점

1. 선생님 계정으로 수업을 엽니다.
2. `Assignments` 섹션으로 갑니다.
3. `Create assignment`를 엽니다.
4. 제목, 설명, 마감일, 만점 점수를 입력합니다.
5. `Save`를 누릅니다.
6. 학생이 제출하면 `Review submissions`에서 확인합니다.
7. 점수와 피드백을 입력하고 `Save grade`를 누릅니다.

학생은 자기 과제만 볼 수 있고, 학부모는 연결된 자녀의 과제 상태만 볼 수 있습니다.

## 10. 퀴즈 만들기

1. 선생님 계정으로 수업을 엽니다.
2. `Quizzes` 섹션에서 퀴즈를 만듭니다.
3. 퀴즈 목록에서 `Manage`를 누릅니다.
4. 퀴즈 관리 페이지에서 `Add question`을 엽니다.
5. 문제 유형을 고릅니다.
   - `MULTIPLE_CHOICE`: 객관식
   - `TRUE_FALSE`: 참/거짓
   - `SHORT_ANSWER`: 짧은 답
   - `ESSAY`: 서술형
6. 문제, 점수, 정답을 입력합니다.
7. 저장합니다.

객관식과 참/거짓은 자동 채점됩니다. 서술형은 선생님이 직접 채점합니다.

## 11. 성적과 성적표

1. 선생님 계정으로 수업을 엽니다.
2. `Grades` 섹션으로 갑니다.
3. `Grade weights`에서 레슨, 출석, 과제, 퀴즈, 시험 비율을 확인합니다.
4. `Calculate final grades`를 누르면 최종 성적 초안이 만들어집니다.
5. 공개할 준비가 되면 `Publish final grades`를 누릅니다.

학생과 학부모는 공개된 성적만 볼 수 있습니다. 초안 성적은 보이지 않습니다.

## 12. PDF 성적표와 Transcript

관리자는 학생 상세 페이지에서 문서를 받을 수 있습니다.

1. 관리자 계정으로 로그인합니다.
2. `Users`를 누릅니다.
3. 학생 이름을 엽니다.
4. `Documents` 영역을 찾습니다.
5. `Report card` 또는 `Download transcript`를 누릅니다.

학생은 Transcript 다운로드를 하루 최대 3회까지 할 수 있습니다.

## 13. 메시지와 알림

### Messages

1. 상단 또는 왼쪽 메뉴에서 메시지 아이콘을 누릅니다.
2. `New message`를 엽니다.
3. 받을 사람을 선택합니다.
4. 내용을 입력하고 보냅니다.

학생은 같은 수업의 선생님에게만 메시지를 보낼 수 있습니다. 학생끼리 직접 메시지는 MVP에서 막혀 있습니다.

### Notifications

1. 알림 아이콘을 누릅니다.
2. 새 과제, 새 메시지, 출석 변경, 성적 공개 알림을 확인합니다.
3. 확인한 알림은 읽음 처리할 수 있습니다.

## 14. 게시판

1. 관리자 또는 선생님 계정으로 로그인합니다.
2. `Boards`를 누르거나 수업 안의 `Boards` 섹션을 엽니다.
3. 공지, Q&A, 자료 게시판을 만들 수 있습니다.
4. 게시글과 댓글을 작성할 수 있습니다.
5. 이미지 첨부는 JPG, PNG, WEBP, GIF만 가능하고 10MB 이하만 됩니다.

## 15. 자주 막히는 부분

| 상황 | 확인할 것 |
| --- | --- |
| 학생에게 수업이 안 보임 | 학생이 해당 Class Section에 등록되어 있는지 확인 |
| 영상이 안 보임 | Lesson이 Published 상태인지 확인 |
| 과제가 제출되지 않음 | 마감일이 지났는지, late submission 허용 여부 확인 |
| 성적이 학생에게 안 보임 | Final grade가 Published 상태인지 확인 |
| 학부모에게 자녀가 안 보임 | Parent와 Student가 연결되어 있는지 확인 |
| 파일이 안 올라감 | 허용된 파일 형식과 10MB 제한 확인 |

## 16. PDF 설명서

아래 PDF는 역할별로 더 쉽게 정리한 설명서입니다.

- [처음 쓰는 쉬운 설명서](docs/manuals/easy-start-guide.pdf)
- [Super Admin 설명서](docs/manuals/super-admin-manual.pdf)
- [School Admin 설명서](docs/manuals/school-admin-manual.pdf)
- [Instructor 설명서](docs/manuals/instructor-manual.pdf)
- [Student 설명서](docs/manuals/student-manual.pdf)
- [Parent 설명서](docs/manuals/parent-manual.pdf)

## 17. 개발자용 문서 다시 만들기

PDF 설명서를 다시 만들려면 아래 명령어를 실행합니다.

```bash
npx tsx scripts/generate-manual-pdfs.ts
```

검사 명령어:

```bash
npx prisma validate
npm run lint
npm run build
```
