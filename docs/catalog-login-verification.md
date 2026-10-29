# 로그인·수강 신청·고정 사이드바 검증

검증일: 2026-10-29. 운영 DB와 분리한 PostgreSQL·Redis·MinIO 및 localhost Next 앱을 사용했다.

## 구현

- 활성 조직의 이름·로고와 게시 기간 안의 공개 LoginNotice만 로그인 전 제공한다. 로고 경로는 조직 ID로 현재 로고만 조회하며 일반 파일 경로의 로그인 검사는 유지한다.
- 모집 공개는 기본 false이다. EnrollmentRequest를 별도로 저장하고 승인 트랜잭션 안에서 대상 ClassSection 행을 잠근 뒤 상태·정원·기존 등록을 검사한다. 재신청·승인·거절·취소와 모집 설정은 감사 기록을 남긴다.
- 승인 권한은 수업 소속 School Admin의 조직·캠퍼스 범위 및 Super Admin에 한정한다. 학생의 원래 조직·학적·역할은 바꾸지 않는다.
- 조직 간 수업 게시판은 등록 기준으로 접근하지만 조직 내부 게시판과 학생의 소속 학교 전체 기록에는 권한을 확장하지 않는다.
- 공통 Footer를 전 역할에 사용하고 사이드바의 가운데 메뉴만 스크롤한다. 하단 메시지·알림·로그아웃·도움말은 접힌 상태에서도 이름과 툴팁이 있는 아이콘으로 제공한다.

## 서버 통합 검사

`scripts/catalog-integration-check.ts`는 localhost 및 포트 5548의 격리 데모 DB에서만 동작한다. 시드 데이터와 테스트용 파일을 준비하고 Next 인증·폼 서버 액션·RPC 및 DB 결과를 확인한다. 운영 환경에서는 실행하지 않는다.

- 공개·비공개·예약·만료 공지, 조직별 필터와 공개 로고 경로, 일반 파일 비로그인 401 검사.
- School Admin의 학교 시간대 공지 저장과 다른 조직 공지 ID 변조 저장 차단.
- Super Admin·School Admin·Academic Staff·Instructor·Student·Parent 기본 페이지 조회.
- 모집 비공개 수업 미노출, 신청 대기 중 강의·파일 차단, 대상 학교 외 관리자 목록 격리 및 ID를 바꾼 승인 차단.
- 정원 1명 수업 동시 승인 요청 2개 중 등록 1개만 생성됨을 확인.
- 승인 후 강의·파일·과제 제출·퀴즈 제출·수업 게시판·대화 참여·연결 학부모 조회, 원래 조직 유지 확인.
- 취소·재신청·거절 사유·앱 알림을 확인.

`scripts/catalog-rules-check.ts`는 조직·캠퍼스 경계, Academic Staff·교수 승인 불가, 공지 소유 조직과 모집 종료·비활성 판정을 검사한다. 기존 보안 검사도 함께 실행한다.

## 마이그레이션·문서

- 신규 격리 DB에 기존 24개와 새 마이그레이션을 적용하고 시드·통합 검사를 실행했다. 새 마이그레이션은 추가형이며 기존 모집 공개는 false로 유지한다.
- PDF 7개 총 93쪽을 렌더링하고 텍스트·한글·목차·책갈피·쪽 번호·페이지 범위를 검사했다. 변경한 로그인·모바일 메뉴·신청·관리 안내 페이지의 배치를 확인했다.
- 새 화면 캡처와 320px·375px·768px·데스크톱 실제 브라우저 시각 검사 및 키보드 조작은 **미완료**다. Computer Use가 현재 URL을 안전하게 확인하지 못해 해당 턴의 UI 작업을 중단했다. 다른 조작 도구로 우회하지 않았다.
- 따라서 새 로그인·사이드바 안내에는 캡처 대신 명시적으로 구분한 메뉴 순서 그림을 사용한다. 기존 기능의 데모 캡처는 유지한다.

## 재검증

```powershell
npx prisma validate
npx tsc --noEmit
npm run lint
npm run test:security
npx tsx scripts/catalog-rules-check.ts
# 격리 DB에 migrate deploy와 prisma/seed.ts를 실행하고 Next dev를 시작한 뒤:
$env:DATABASE_URL = 'postgresql://lms_demo:catalog_demo_only@127.0.0.1:5548/lms_demo'
$env:TEST_BASE_URL = 'http://localhost:3028'
npx tsx scripts/catalog-integration-check.ts
```

통합 검사는 Next dev의 서버 액션 manifest를 사용한다. 테스트 MinIO는 127.0.0.1:9048, 버킷 catalog-demo이며 자격 증명은 스크립트의 데모 전용 값이다. 운영 데이터·자격 증명을 사용하지 않는다.

운영 배포 전 DB 백업을 만들고 `pg_restore --list`로 확인한다. main 게시 후 기존 `deploy-lms`로 배포하며 운영에서는 모집 공개나 공지를 자동으로 켜지 않는다.
