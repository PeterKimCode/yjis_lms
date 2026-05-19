# YJIS LMS 앱 기능 정의서

## 개요

YJIS LMS는 학교 수업 운영, 학습 관리, 출석, 과제, 퀴즈, 성적, 문서,
게시판, 메시지, 알림을 하나의 로컬 우선 시스템으로 통합합니다.

## 공통 기능

| 기능 | 설명 |
| --- | --- |
| 인증 | NextAuth 기반 로그인, 로그아웃, 역할별 대시보드 이동 |
| 역할 권한 | Super Admin, School Admin, Academic Staff, Instructor, Student, Parent |
| 알림 | DB 기반 인앱 알림, 읽음/안읽음, 보관, 역할별 배지 |
| 메시지 | 텍스트 전용 1:1, 반 그룹, 학부모-교사 대화 |
| 파일 | 권한 검사 다운로드 라우트, 일부 모듈의 보안 업로드 |

## 관리자 기능

| 기능 | 세부 내용 |
| --- | --- |
| Overview | 주요 운영 지표, 빠른 이동, 메시지/알림 상태 |
| Organizations | 기관명, 기관 유형, 활성 상태 관리 |
| Campuses | 캠퍼스 생성, 기본 정책 및 등급표 초기화 |
| Academic Years | 학년도 기간과 상태 관리 |
| Terms | 학기명, 순서, 시작/종료일 관리 |
| Grade Levels | 학년/레벨 시퀀스 관리 |
| Homerooms | 담임반, 담임교사, 학생 배치 관리 |
| Departments | 학과/부서 관리 |
| Courses | 강좌명, 코드, 학점, 기본 수업 방식 관리 |
| Class Sections | 반 생성, 강사 배정, 학생 등록, 반 기록 확인 |
| Users | 사용자 생성, 역할 배정, 학생-학부모 연결 |
| Policies | 출석, 영상, 과제, 성적 공개, 문서, GPA, 등급표 정책 |
| Boards | 학교/캠퍼스/반 게시판 생성, 게시글 관리 |
| Documents | 학생별 리포트 카드와 성적표 PDF 생성 |

## 강사 기능

| 기능 | 세부 내용 |
| --- | --- |
| Dashboard | 담당 반, 읽지 않은 메시지, 알림 확인 |
| Lessons | 수업 자료 생성, 영상/텍스트/파일/퀴즈/과제 유형 지원 |
| Sessions | 예정 수업 생성, 출석 세션 생성 |
| Attendance | 기본 Present, 행별 저장, 세션 전체 저장, 학생/학부모 알림 |
| Assignments | 과제 생성, 제출 확인, 점수와 피드백 입력 |
| Quizzes | 퀴즈 생성, 문제 관리, 시도 검토, 수동 채점 |
| Exams | 시험 일정 및 기본 시험 정보 관리 |
| Grades | 모듈 비율 기반 최종 성적 계산, 게시 |
| Boards | 반 공지, Q&A, 자료 게시판 운영 |
| Messages | 학생, 학부모, 반 그룹 메시지 |

## 학생 기능

| 기능 | 세부 내용 |
| --- | --- |
| Dashboard | 수강 반, 메시지, 알림, 문서 상태 확인 |
| Classes | 수강 중인 반 목록과 반 상세 진입 |
| Lessons | 학습 자료 조회, 영상 진행률 기록 |
| Assignments | 과제 확인, 텍스트 답변 및 허용 첨부 제출 |
| Quizzes | 공개된 퀴즈 응시, 결과 확인 |
| Boards | 허용된 반 게시판 조회, 글/댓글 작성 |
| Grades | 게시 또는 확정된 성적 확인 |
| Documents | 공개된 리포트 카드와 성적표 다운로드 |
| Messages | 수강 반 선생님과 직접 메시지, 반 그룹 대화 |

## 학부모 기능

| 기능 | 세부 내용 |
| --- | --- |
| Dashboard | 연결된 학생, 메시지, 알림 확인 |
| Student Detail | 연결 학생의 수업, 출석, 과제, 퀴즈, 성적 확인 |
| Documents | 공개된 문서 다운로드 |
| Boards | 연결 학생 반의 허용 게시판 확인 |
| Messages | 연결 학생 담당 선생님에게 메시지 |

## 정책 기능

| 정책 | 적용 영역 |
| --- | --- |
| AttendancePolicy | 출석률 계산, late/excused 처리 |
| VideoCompletionPolicy | 영상 완료 기준 |
| AssignmentPolicy | 지각 제출 기본값, 재제출 가능 여부 |
| GradingPolicy | 성적 공개, GPA scale, 문서 공개 정책 |
| GradingScale | 숫자 점수에서 letter grade, grade point 변환 |

## MVP 제외 또는 추후 확장

- 실시간 WebSocket/SSE 알림
- 이메일, SMS, Kakao, Push 알림
- 메시지 파일 첨부
- 고급 GradeCategory / GradeItem 수동 gradebook
- 운영용 바이러스 스캔, ZIP bomb 방어, 파일 쿼터
- 고급 리포트/통계 대시보드

