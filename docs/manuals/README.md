# PDF 매뉴얼 제작·재생성

현재 문서 기준은 **2026-10-04**, 화면 기준은 **`7768f57` 및 전체 역할 UX 개선 변경**입니다. 6개 역할 PDF와 공통 시작 PDF의 원문·이미지·생성기를 이 폴더에서 관리합니다.

이번 갱신에는 교수의 임시 저장 복원·버리기, 학생 할 일, 학부모 공개 시험, 계정별 사이드바 상태 안내를 반영했습니다. 추가 화면은 운영 데이터와 분리한 검증 환경에서 캡처했습니다. 기능이 그대로인 작업은 이전 데모 캡처를 유지합니다.

## 파일 구성

- `source/manuals.json`: 제목·목차·작업별 안내·확대 영역·표시 번호의 편집 원본
- `source/build_manuals.py`: ReportLab PDF 생성기. A4 세로, 안내 본문 16pt, 한글 TTF 내장, 목차 링크·책갈피·쪽 번호 생성
- `source/verify_manuals.py`: Poppler로 모든 페이지를 PNG로 렌더링하고 페이지 수·목차·책갈피·텍스트 범위를 검사
- `source/requirements.txt`: 문서 생성·검수용 Python 의존성
- `images/*.jpg`: 최신 앱의 실제 데모 캡처. 실제 운영 사용자 자료는 사용하지 않음
- `images/captures.json`: 캡처 때 확인한 화면 요소 좌표. 원본 화면의 CSS 픽셀 단위
- `images/manual-preview.png`: 안내 페이지 예시
- 역할별 `*-manual.pdf` 및 `easy-start-guide.pdf`: 배포하는 완성 PDF
- `verification.md`: 권한·기능·시각 검수 기록

`source/manuals.json`의 `crop`은 `[x, y, width, height]`입니다. `labels`는 `captures.json`에서 좌표를 가져오며, `boxes`는 이미지에서 직접 확인한 번호·좌표를 지정합니다. 생성기는 이미지 밖의 확대 영역이나 확대 영역 밖의 번호 표시, 본문 넘침을 오류로 처리합니다. 번호·테두리·화살표는 PDF 벡터로 그리므로 확대해도 선명합니다.

## 준비

저장소 루트에서 실행합니다. Python 3.10 이상과 아래 패키지가 필요합니다. 앱 의존성·DB와 별개입니다.

```powershell
python -m pip install -r docs/manuals/source/requirements.txt
```

기본 한글 글꼴은 Windows의 `C:/Windows/Fonts/malgun.ttf`, `malgunbd.ttf`입니다. 글꼴 파일 자체는 저장소에 복사하지 않습니다. 다른 운영체제에서는 사용 가능한 **한글 TrueType 글꼴** 경로를 지정하세요.

```powershell
$env:LMS_MANUAL_FONT = 'C:/Windows/Fonts/malgun.ttf'
$env:LMS_MANUAL_BOLD_FONT = 'C:/Windows/Fonts/malgunbd.ttf'
# 여러 Python이 설치되어 있다면 실제 실행 파일을 지정
$env:LMS_MANUAL_PYTHON = 'C:/path/to/python.exe'
```

Node 진입 스크립트는 `LMS_MANUAL_PYTHON`을 우선 사용합니다. Windows에 Codex 번들 Python이 있으면 이를 사용하고, 없으면 시스템 `python`(다른 OS는 `python3`)을 사용합니다. 패키지는 **선택한 Python**에 설치해야 합니다. 검수용 `pdftoppm`은 Poppler를 설치한 후 PATH에 추가합니다. Codex 환경에서는 번들 Poppler를 사용할 수 있습니다.

## 생성

```powershell
npx tsx scripts/generate-manual-pdfs.ts
# 한 권만 다시 만들기
npx tsx scripts/generate-manual-pdfs.ts --only instructor-manual.pdf
# Node 없이 직접 실행해도 같은 결과
python docs/manuals/source/build_manuals.py
```

총 7개 파일을 동일한 이름으로 생성합니다. 생성기는 인터넷·LMS DB·운영 서버에 접속하지 않습니다. 입력 JSON·이미지·글꼴이 같으면 같은 PDF를 생성합니다.

## 전체 페이지 검수

```powershell
python docs/manuals/source/verify_manuals.py
```

선택한 Python 경로가 다르면 위 `python`을 해당 경로로 바꾸세요. 결과는 임시 폴더 `tmp/pdfs/manual-qa/`에 저장합니다. 검수 결과 이미지는 커밋하지 않고 검수 후 지웁니다.

1. 7개 PDF의 **모든 페이지 PNG**와 4쪽 단위 확인 이미지를 생성합니다.
2. 쪽 수·PDF 책갈피·목차 링크·쪽 번호·한글 텍스트·페이지 밖 텍스트를 검사합니다.
3. 확인 이미지를 모두 보고 한글 깨짐·잘림·겹침·표시 번호·화면 가독성을 확인합니다. 자동 검사만으로 시각 검수를 대신하지 않습니다.
4. 작은 버튼이 있으면 확대 화면과 해당 페이지 PNG를 원래 크기로 다시 봅니다.
5. 문구를 현재 화면·권한 코드와 대조하고 README의 상대 링크도 확인합니다.
6. `verification.md`에 기준 앱 커밋·검수 일자·페이지 수·검수 범위를 기록합니다.

## 화면 갱신 원칙

실제 최신 앱 화면을 캡처합니다. 개인정보나 비밀번호가 있는 운영 계정 화면을 넣지 마세요. 필요한 예시 기록은 운영 DB·파일 저장소와 분리된 데모 환경에서만 준비합니다. 데모 계정 이름·이메일도 데모임을 명확히 합니다. 로그인 캡처와 계정 생성 화면의 비밀번호란은 비워 둡니다.

2026-10-04 제작에서는 현재 운영 앱 이미지를 사용하되 **독립 DB·Redis·MinIO의 데모 환경**으로 실행했습니다. 데이터 준비와 UI 검증은 이 환경에서만 했으며 운영 데이터·앱 기능·권한은 바꾸지 않았습니다. 제작 후 임시 환경을 정리합니다.

School Admin은 가족 연결과 상세 학사 서류 영역을 사용할 수 없고 Academic Staff는 허용된 조직·캠퍼스 범위에서만 작업합니다. 역할 이름만 보고 기능을 추측하지 말고 화면과 서버 권한을 함께 확인하세요.

## 게시

README, 공통 안내, PDF·캡처·제작 원본·생성 스크립트만 GitHub `main`에 커밋·푸시합니다. **문서만 갱신할 때는 `deploy-lms`를 실행하지 않습니다.** 앱 재배포는 기능·운영 변경이 있을 때 기존 절차에 따라 진행합니다.
