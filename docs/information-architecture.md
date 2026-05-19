# YJIS LMS Information Architecture

## 목적

YJIS LMS의 정보 구조는 학교 운영자가 학사 기준 데이터를 만들고, 강사가 반을 운영하며,
학생과 학부모가 본인에게 허용된 학습 정보를 확인하는 흐름을 기준으로 설계되었습니다.

## 사용자 역할

| 역할 | 주요 목적 | 대표 진입점 |
| --- | --- | --- |
| Super Admin | 전체 조직과 캠퍼스 운영 관리 | `/admin` |
| School Admin / Academic Staff | 학교 또는 캠퍼스 범위 학사 운영 | `/admin` |
| Instructor / Homeroom Teacher | 담당 반 수업 운영 | `/instructor` |
| Student | 수업 참여와 제출, 결과 확인 | `/student` |
| Parent | 연결된 학생의 학업 정보 확인 | `/parent` |

## 최상위 내비게이션

```text
Home
├─ Login / Logout
├─ Admin
│  ├─ Overview
│  ├─ Class Sections
│  ├─ Courses
│  ├─ Users
│  ├─ Boards
│  ├─ Academic setup
│  │  ├─ Organizations
│  │  ├─ Campuses
│  │  ├─ Academic Years
│  │  ├─ Terms
│  │  ├─ Grade Levels
│  │  ├─ Homerooms
│  │  ├─ Departments
│  │  └─ Policies
│  ├─ Messages
│  └─ Notifications
├─ Instructor
│  ├─ Dashboard
│  ├─ Classes
│  ├─ Class Detail
│  │  ├─ Lessons
│  │  ├─ Sessions
│  │  ├─ Attendance
│  │  ├─ Assignments
│  │  ├─ Quizzes
│  │  ├─ Exams
│  │  ├─ Grades
│  │  └─ Boards
│  ├─ Messages
│  └─ Notifications
├─ Student
│  ├─ Dashboard
│  ├─ Classes
│  ├─ Class Detail
│  ├─ Lesson Detail
│  ├─ Messages
│  └─ Notifications
└─ Parent
   ├─ Dashboard
   ├─ Linked Students
   ├─ Student Detail
   ├─ Messages
   └─ Notifications
```

## 정보 구조 원칙

- 관리자 정보는 운영 기준 데이터와 학생 기록 조회를 분리합니다.
- 강사 화면은 반 상세 페이지에 수업 운영 기능을 세로 섹션으로 배치합니다.
- 학생과 학부모는 자신의 범위 안에서만 학습/성적/문서 정보를 봅니다.
- 게시판, 메시지, 알림은 모든 역할에서 공통 커뮤니케이션 레이어로 동작합니다.
- 정책은 조직 기본값, 캠퍼스 오버라이드, 반 단위 문맥으로 해석됩니다.

## 주요 사용자 흐름

### 관리자 학사 셋업

1. Organization 생성
2. Campus 생성 및 기본 정책 초기화
3. Academic Year / Term 생성
4. Course 생성
5. Class Section 생성
6. Instructor 배정
7. Student 등록
8. Policies 검토

### 강사 수업 운영

1. Instructor Dashboard 진입
2. 담당 Class Section 선택
3. Lesson / Session / Assignment / Quiz 생성
4. Attendance 관리
5. 제출물과 시도 채점
6. Final Grade 계산 및 게시
7. Board와 Messages로 커뮤니케이션

### 학생 학습 흐름

1. Student Dashboard 진입
2. 수강 Class 선택
3. Lesson 학습 및 영상 진행
4. Assignment 제출
5. Quiz 응시
6. 공개된 Grade / Document 확인
7. Teacher 또는 Class Group 메시지 사용

### 학부모 확인 흐름

1. Parent Dashboard 진입
2. 연결된 학생 선택
3. 학생별 Class / Attendance / Assignment / Quiz / Grade 확인
4. 허용된 문서 다운로드
5. Teacher 메시지 사용

## 권한 경계

- Student는 다른 학생의 성적, 제출물, 메시지, 출석을 볼 수 없습니다.
- Parent는 연결된 학생의 정보만 볼 수 있습니다.
- Instructor는 담당 Class Section만 관리합니다.
- School Admin은 범위 내 Organization / Campus 데이터만 관리합니다.
- Super Admin은 전체 범위를 관리합니다.

