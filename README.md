# YJIS LMS

YJIS LMS는 학교 운영을 위한 로컬 우선(Self-hosted) 학습관리시스템입니다.
Next.js, Prisma, PostgreSQL, Redis, MinIO 기반으로 동작하며 관리자, 강사,
학생, 학부모 역할별 대시보드와 학사 운영 기능을 제공합니다.

## 빠른 시작

```bash
npm install
docker compose up -d
npx prisma migrate dev
npx prisma db seed
npm run dev
```

브라우저에서 아래 주소를 엽니다.

```text
http://localhost:3000
```

## 주요 명령어

```bash
npm run dev
npm run lint
npm run build
npm run start
npm run worker
npm run worker:once
```

`npm run worker`는 과제 마감 예정 알림, 퀴즈 오픈 알림처럼 주기적으로
확인해야 하는 LMS 백그라운드 작업을 실행합니다.

## 로컬 인프라

개발 환경은 Docker Compose로 실행합니다.

- PostgreSQL: 애플리케이션 데이터
- Redis: 캐시 및 큐 준비 인프라
- MinIO: S3 호환 파일 저장소
- NextAuth: 인증
- Prisma: 데이터베이스 접근 및 마이그레이션

```bash
docker compose up -d
```

PostgreSQL, Redis, MinIO는 외부 인터넷에 직접 공개하지 마세요.

## 데모 계정

`npx prisma db seed` 실행 후 아래 로컬 데모 계정을 사용할 수 있습니다.

| 역할 | 이메일 | 비밀번호 |
| --- | --- | --- |
| SUPER_ADMIN | `super.admin@demo.local` | `DemoPass123!` |
| SCHOOL_ADMIN | `school.admin@demo.local` | `DemoPass123!` |
| INSTRUCTOR | `instructor@demo.local` | `DemoPass123!` |
| STUDENT | `student@demo.local` | `DemoPass123!` |
| PARENT | `parent@demo.local` | `DemoPass123!` |

데모 계정은 로컬 개발과 테스트용입니다. 운영 환경에서 그대로 사용하지 마세요.

## 계정 유형별 PDF 설명서

PDF 설명서는 `docs/manuals` 폴더에 있습니다.

- [Super Admin 설명서](docs/manuals/super-admin-manual.pdf)
- [School Admin / Academic Staff 설명서](docs/manuals/school-admin-manual.pdf)
- [Instructor 설명서](docs/manuals/instructor-manual.pdf)
- [Student 설명서](docs/manuals/student-manual.pdf)
- [Parent 설명서](docs/manuals/parent-manual.pdf)

설명서 PDF를 다시 생성하려면 아래 명령을 실행합니다.

```bash
npx tsx scripts/generate-manual-pdfs.ts
```

## 현재 구현된 주요 기능

- 역할별 대시보드: 관리자, 강사, 학생, 학부모
- 학사 설정: 조직, 캠퍼스, 학년도, 학기, 강좌, 반
- 수업 운영: Lessons, Sessions, Attendance, Assignments, Quizzes, Exams
- 출석 정책, 영상 완료 정책, 과제 정책, 성적 공개 정책, 문서 정책, GPA 정책
- 과제 제출, 강사 채점, 학생/학부모 공개 범위 제어
- 퀴즈 문제 관리, 시도, 자동 채점, 수동 채점
- 모듈 비율 기반 MVP 성적 계산과 최종 성적 게시
- 리포트 카드와 성적표 PDF 생성
- 게시판, 게시글, 댓글, 게시판 이미지 첨부
- 텍스트 전용 메시지: 1:1, 반 그룹, 학부모-교사 대화
- 인앱 알림 센터와 백그라운드 워커 알림

## 프로젝트 구조

- `src/app`: Next.js App Router 페이지, 레이아웃, API 라우트
- `src/components`: 공통 UI 컴포넌트
- `src/modules`: LMS 도메인별 기능 모듈
- `src/lib`: 공통 서버/클라이언트 유틸리티
- `prisma`: Prisma 스키마, 마이그레이션, 시드 데이터
- `docs`: 보안, 구현 메모, 사용자 설명서
- `scripts`: 워커와 문서 생성 스크립트

## 보안 메모

- `.env`와 `.env.local`은 커밋하지 않습니다.
- 로컬 설정은 `.env.example`을 기준으로 작성합니다.
- 파일 다운로드는 권한 검사를 거치는 앱 라우트를 통해 제공해야 합니다.
- 학생과 학부모는 게시 또는 확정된 성적/문서만 볼 수 있습니다.
- 메시지는 현재 텍스트 전용이며, 파일 첨부는 구현하지 않았습니다.

## 작업 전후 확인

변경 사항을 넘기기 전 아래 명령을 실행합니다.

```bash
npx prisma validate
npm run lint
npm run build
```

Prisma 스키마를 변경했다면 아래 명령도 실행합니다.

```bash
npx prisma generate
```
