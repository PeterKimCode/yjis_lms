# YJIS LMS 화면 설계서

## 화면 설계 원칙

- 큰 관리 섹션은 한 줄에 하나씩 배치합니다.
- 반복 업무는 표와 접이식 폼을 함께 사용합니다.
- 학생/학부모 화면은 읽기 중심으로 단순화합니다.
- 권한이 없는 작업 버튼은 숨기되, 서버에서도 권한을 다시 검사합니다.
- 넓은 표는 `overflow-x-auto`로 감싸 가로 겹침을 방지합니다.

## 공통 화면 요소

| 요소 | 설명 |
| --- | --- |
| Header / Nav | 역할별 주요 메뉴, Messages, Notifications 배지 |
| Summary Cards | 개수, 비율, 상태를 빠르게 보여주는 카드 |
| Data Table | 목록 조회, 검색, 상태 표시, 상세 진입 |
| Details / Summary | 큰 생성/관리 폼을 접고 펼치는 패턴 |
| Status Badge | Published, Draft, Active, Inactive 등 상태 표시 |
| Empty State | 데이터가 없을 때 다음 행동을 안내 |

## 홈 / 인증

| 화면 | 경로 | 주요 구성 |
| --- | --- | --- |
| Home | `/` | 로그인 상태, 현재 계정 역할, 역할별 대시보드 CTA |
| Login | `/login` | 이메일/비밀번호 로그인, 데모 계정 안내 |
| Logout | `/logout` | 세션 종료 |

## 관리자 화면

| 화면 | 경로 | 주요 구성 |
| --- | --- | --- |
| Overview | `/admin` | 운영 요약, 빠른 링크, 메시지/알림 상태 |
| Users | `/admin/users` | 사용자 검색, 역할, 활성 상태, 상세 진입 |
| User Detail | `/admin/users/[userId]` | 계정 정보, 학생 배치, 학부모 연결, 문서 |
| Student Class Record | `/admin/users/[userId]/classes/[classSectionId]` | 학생의 반별 출석/진도/과제/퀴즈/성적 |
| Courses | `/admin/courses` | 강좌 생성/수정, 코드, 학점, 수업 방식 |
| Class Sections | `/admin/class-sections` | 반 목록, course 선택 자동 입력 폼 |
| Class Section Detail | `/admin/class-sections/[classSectionId]` | 반 요약, 강사 배정, 학생 등록 |
| Boards | `/admin/boards` | 게시판 필터, 생성, 관리 진입 |
| Board Manage | `/admin/boards/[boardId]` | 설정, 게시글, 댓글, 이미지 첨부 |
| Policies | `/admin/policies` | 범위 선택, 정책 폼, 등급표 편집 |

## 강사 화면

| 화면 | 경로 | 주요 구성 |
| --- | --- | --- |
| Dashboard | `/instructor` | 담당 반, 메시지, 알림 |
| Classes | `/instructor/classes` | 담당 반 목록 |
| Class Detail | `/instructor/classes/[classSectionId]` | Lessons, Sessions, Attendance, Assignments, Quizzes, Exams, Grades, Boards |
| Quiz Manage | `/instructor/classes/[classSectionId]/quizzes/[quizId]` | 퀴즈 설정, 문제, 시도, 수동 채점 |
| Board Detail | `/instructor/classes/[classSectionId]/boards/[boardId]` | 게시글 작성, 댓글 관리 |

## 학생 화면

| 화면 | 경로 | 주요 구성 |
| --- | --- | --- |
| Dashboard | `/student` | 수강 반, 읽지 않은 메시지/알림, 문서 |
| Classes | `/student/classes` | 수강 반 목록 |
| Class Detail | `/student/classes/[classSectionId]` | 수업, 출석, 과제, 퀴즈, 게시판, 공개 성적 |
| Lesson Detail | `/student/classes/[classSectionId]/lessons/[lessonId]` | 영상/텍스트 학습, 진행률 기록 |
| Board Detail | `/student/classes/[classSectionId]/boards/[boardId]` | 게시글과 댓글 |

## 학부모 화면

| 화면 | 경로 | 주요 구성 |
| --- | --- | --- |
| Dashboard | `/parent` | 연결 학생, 메시지, 알림 |
| Linked Students | `/parent/students` | 연결된 학생 목록 |
| Student Detail | `/parent/students/[studentId]` | 학생별 수업, 과제, 퀴즈, 성적, 문서 |
| Board Detail | `/parent/students/[studentId]/classes/[classSectionId]/boards/[boardId]` | 허용 게시판 조회 |

## 메시지와 알림

| 화면 | 경로 | 주요 구성 |
| --- | --- | --- |
| Messages | `/messages` | 대화 목록, 검색/필터, 새 메시지 |
| Conversation | `/messages/[conversationId]` | 메시지 목록, 작성, 읽음 처리 |
| Notifications | `/notifications` | 알림 목록, 읽음/안읽음, 전체 읽음, 보관 |

## 출석 관리 상세 UX

- 출석 세션 생성 시 학생 기본값은 Present입니다.
- Manage attendance는 세션별 표로 표시됩니다.
- 각 행의 Save는 해당 학생만 저장합니다.
- Save all은 세션 내 학생 전체를 한 번에 저장합니다.
- 변경이 발생한 학생과 연결 학부모에게만 알림이 생성됩니다.

## Class Section 생성 UX

- Course 선택 시 Organization, Campus, Title, Section code, Delivery mode가 자동 입력됩니다.
- 사용자는 자동 입력된 값을 필요에 따라 수정할 수 있습니다.
- Academic year와 Course는 필수입니다.

