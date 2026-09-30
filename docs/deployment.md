# LMS 배포

일반 배포 순서:

1. 작업 PC에서 변경사항을 검증하고 GitHub `main`에 커밋·푸시합니다.
2. gmk 서버에 접속해 `deploy-lms`를 실행합니다.
3. 로컬 및 공개 URL 상태 확인이 모두 성공하면 배포 완료가 표시됩니다.

`deploy-lms`는 작업 PC의 미커밋 파일을 읽지 않습니다. GitHub `origin/main`을 가져와 서버 소스를 fast-forward하고, 앱 이미지 빌드 → Prisma 마이그레이션 → 앱 컨테이너 교체 → 상태 확인 순서로 실행합니다.

## 서버 설정

- 프로젝트: `/srv/docker/sites/lms`
- Compose 파일: `docker-compose.gmk.yml`
- 명령: `/usr/local/bin/deploy-lms` → 프로젝트의 `deploy.sh`
- `deploy.sh`는 Git으로 관리되는 `scripts/deploy-lms.sh`를 실행하는 진입 스크립트입니다. 이후 배포 로직 수정도 GitHub를 통해 전달합니다.
- DB·파일 저장소·환경변수 설정은 서버에 유지합니다. 일반 배포는 앱 컨테이너만 교체합니다.

## 오류와 복구

- 서버에 미커밋 소스 변경이 있거나 `main`이 아니면 중단합니다. 변경사항을 삭제하거나 강제로 덮어쓰지 않습니다.
- `deploy-lms --check`로 배포 전 상태를 확인할 수 있습니다. 이 명령은 GitHub 갱신이나 실제 배포를 수행하지 않습니다.
- 서버 파일을 의도적으로 직접 변경한 예외 상황에서만 `deploy-lms --local`을 사용합니다. 일반 배포에는 필요 없습니다.
- 이전 앱 이미지는 `lms-app:before-deploy-날짜` 태그로 보관합니다. 실패 시 스크립트가 해당 태그를 출력합니다. DB 마이그레이션은 자동으로 되돌리지 않습니다.
- 빌드·마이그레이션·상태 확인 중 실패하면 성공 메시지를 표시하지 않고 오류로 종료합니다.

스크립트 회귀 검사는 Linux에서 `bash scripts/deploy-lms-check.sh`로 실행합니다. 테스트는 임시 Git 저장소와 모의 Docker 명령을 사용합니다.
