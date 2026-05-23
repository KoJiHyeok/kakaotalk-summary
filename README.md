# 카카오톡 미국주식 오픈채팅방 요약 MVP

카카오톡 오픈채팅방에서 내보낸 `.txt` 파일을 웹페이지에 업로드하면, 대화를 날짜별로 파싱하고 미국 주식 채팅방에 맞는 규칙 기반 일일 요약을 생성해 조회하는 MVP입니다.

자동 수집이나 카카오톡 크롤링은 포함하지 않습니다. 현재 버전은 사용자가 직접 내보낸 TXT 파일 업로드만 지원합니다.

## 처음 실행 방법

Node.js 20 이상이 필요합니다.

처음 한 번은 의존성을 설치합니다.

```powershell
npm install
```

이후 기본 실행은 다음 중 하나를 사용합니다.

```powershell
.\start-app.bat
```

또는 PowerShell 스크립트를 사용할 수 있습니다.

```powershell
.\start-app.ps1
```

브라우저가 자동으로 `http://localhost:3000`을 엽니다.

## 기본 실행 방법

터미널에서 직접 실행하려면 다음 명령을 사용합니다.

```bash
npm start
```

또는 직접 실행할 수 있습니다.

```bash
node src/server.js
```

브라우저에서 다음 주소를 엽니다.

```text
http://localhost:3000
```

서버가 실행되면 기본적으로 `watch/` 폴더도 함께 감시합니다. 감시 기능을 끄고 싶으면 다음처럼 실행합니다.

```bash
WATCH_ENABLED=false node src/server.js
```

포트를 바꾸려면 환경 변수 `PORT`를 지정합니다.

```bash
PORT=4000 node src/server.js
```

## Windows PowerShell 실행 방법

PowerShell에서는 다음처럼 실행합니다.

```powershell
$env:PORT=3000
node src/server.js
```

기본 규칙 기반 요약만 사용하려면 다음 실행 스크립트를 권장합니다.

```powershell
.\start-app.ps1
```

Gemini를 켜고 실행하려면 다음 스크립트를 사용합니다.

```powershell
.\start-gemini-app.ps1
```

`.bat` 파일을 더블클릭해서 실행할 수도 있습니다.

- `start-app.bat`: 기본 규칙 기반 실행
- `start-gemini-app.bat`: Gemini 활성화 실행

## Windows 시작 시 자동 실행

Windows 시작프로그램 폴더에 바로가기를 등록하면 PC를 켤 때 앱을 자동으로 실행할 수 있습니다. 이 프로젝트는 자동으로 시작프로그램을 등록하지 않습니다. 필요할 때 아래 스크립트를 직접 실행하세요.

시작프로그램 폴더:

```text
%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
```

기본 규칙 기반 실행을 자동 등록:

```powershell
.\install-startup.ps1
```

또는 배치 파일을 더블클릭합니다.

```text
install-startup.bat
```

Gemini 실행을 자동 등록:

```powershell
.\install-startup.ps1 -Gemini
```

또는 명령 프롬프트에서 다음처럼 실행합니다.

```bat
install-startup.bat gemini
```

자동 실행 해제:

```powershell
.\uninstall-startup.ps1
```

Gemini 자동 실행 바로가기 해제:

```powershell
.\uninstall-startup.ps1 -Target Gemini
```

둘 다 해제:

```powershell
.\uninstall-startup.ps1 -Target All
```

배치 파일로 해제:

```bat
uninstall-startup.bat
uninstall-startup.bat gemini
uninstall-startup.bat all
```

생성되는 바로가기 이름:

- `KakaoTalk Stock Summary.lnk`
- `KakaoTalk Stock Summary Gemini.lnk`

`start-app.bat`와 `start-gemini-app.bat` 차이:

- `start-app.bat`: `GEMINI_ENABLED=false`로 기본 규칙 기반 요약만 사용합니다.
- `start-gemini-app.bat`: `GEMINI_ENABLED=true`로 실행합니다. API 키는 스크립트에 저장하지 않고 `.env` 또는 Windows 환경변수에서 읽습니다.

자동 실행 등록 후 확인 방법:

1. PC를 재부팅합니다.
2. 브라우저에서 `http://localhost:3000`을 엽니다.
3. 홈 화면과 `/watch` 페이지가 열리는지 확인합니다.
4. `watch/` 폴더에 TXT 파일을 넣어 자동 처리되는지 확인합니다.

API 키 보안:

- Gemini API 키는 `.env` 또는 Windows 사용자 환경변수에만 저장하세요.
- `.env`는 `.gitignore`에 포함되어 있으며 Git에 커밋하면 안 됩니다.
- `start-gemini-app.bat`, `start-gemini-app.ps1`, `install-startup` 스크립트에 API 키를 직접 쓰지 마세요.

감시 기능을 끄고 실행하려면 다음처럼 지정합니다.

```powershell
$env:WATCH_ENABLED="false"
node src/server.js
```

## Gemini 고급 요약 설정

기본 동작은 기존 규칙 기반 요약입니다. Gemini API 키가 없거나 `GEMINI_ENABLED=true`가 아니면 Gemini 호출은 건너뛰며 앱은 정상 동작합니다.

`.env.example`을 참고해 `.env` 파일을 만들면 앱이 시작할 때 자동으로 읽습니다. `.env` 파일은 Git에 올리면 안 되며, `.gitignore`에 포함되어 있습니다.

```powershell
Copy-Item .env.example .env
notepad .env
```

`.env`에 실제 API 키를 넣은 뒤 `start-gemini-app.bat` 또는 `start-gemini-app.ps1`로 실행합니다. API 키를 실행 스크립트, README, 커밋에 직접 넣지 마세요.

PowerShell 환경변수로 직접 지정할 수도 있습니다.

```powershell
$env:GEMINI_ENABLED="true"
$env:GEMINI_API_KEY="your_gemini_api_key_here"
$env:GEMINI_MODEL="gemini-2.5-flash"
node src/server.js
```

지원 환경변수:

- `GEMINI_ENABLED`: `true`일 때만 Gemini 호출 후보가 됩니다.
- `GEMINI_API_KEY`: Google Gemini API 키입니다. 없으면 호출하지 않습니다.
- `GEMINI_MODEL`: 기본값은 `gemini-2.5-flash`입니다.
- `GEMINI_MAX_INPUT_CHARS`: Gemini 입력 프롬프트 최대 길이입니다. 기본값은 `20000`입니다.
- `OPEN_SUMMARY_AFTER_WATCH`: `true`이면 watch 처리 성공 후 최신 요약 상세 페이지를 기본 브라우저로 엽니다. 기본값은 `false`입니다.

Gemini에는 원본 TXT 전체를 보내지 않습니다. 날짜, 메시지 수, 제외/파싱 실패 수, 규칙 기반 결론, 핵심 흐름, TOP 종목/자산, 종목별 요약 TOP 5, 체크포인트, 논쟁/리스크, 제한된 샘플 메시지 최대 50개만 전달합니다.

API 키 보안 주의:

- 실제 API 키는 `.env` 또는 Windows 사용자 환경변수에만 저장하세요.
- `.env`는 커밋하지 마세요.
- `start-gemini-app.bat`와 `start-gemini-app.ps1`에는 API 키를 저장하지 않습니다.

테스트는 다음 명령으로 실행합니다.

```powershell
node --test
```

## TXT 업로드 방법

1. 카카오톡 오픈채팅방에서 대화를 TXT 파일로 내보냅니다.
2. 웹페이지의 업로드 화면에서 `.txt` 파일을 선택합니다.
3. 업로드 버튼을 누르면 날짜별 파싱, 분석, 요약 저장이 진행됩니다.
4. 처리 결과 화면에서 감지 날짜 수, 파싱 메시지 수, 제외 메시지 수, 파싱 실패 수를 확인합니다.
5. `/summaries`에서 날짜별 요약 목록을 확인합니다.

지원하는 주요 형식 예시:

```text
--------------- 2026년 5월 22일 금요일 ---------------
[세히자영] [오후 6:12] 프장이라 ㄱㅊ욤
[유튜브닉네임핫도그] [오후 6:13] 엔비디아 실적 기대가 크네요
[페이온] [오후 6:18] 여러 줄 메시지 첫 줄
두 번째 줄도 같은 메시지로 이어집니다.
```

날짜 구분선 이후의 `[작성자] [오전/오후 h:mm] 메시지` 형식을 우선 처리합니다. 작성자 이름에 공백, 숫자, 특수문자가 포함되어도 가능한 한 파싱합니다.

## watch 폴더 자동 처리

2차 기능으로 로컬 감시 폴더 처리를 지원합니다. 이것은 카카오톡 자동 수집이 아니라, 사용자가 직접 내보낸 TXT 파일을 로컬 폴더에 넣으면 서버가 자동으로 처리하는 기능입니다.

사용 방법:

1. 서버를 실행합니다.
2. `watch/` 폴더에 카카오톡 TXT 파일을 넣습니다.
3. 서버가 파일 크기와 수정 시간이 안정된 뒤 자동으로 처리합니다.
4. 성공한 파일은 `watch/processed/`로 이동합니다.
5. 실패한 파일은 `watch/failed/`로 이동합니다.
6. 처리 상태는 `/watch` 페이지에서 확인합니다.

감시 폴더:

```text
watch/
```

처리 완료 폴더:

```text
watch/processed/
```

실패 폴더:

```text
watch/failed/
```

중복 처리는 파일 SHA-256 해시와 크기를 기준으로 방지합니다. 이미 처리된 파일과 동일한 해시의 TXT가 다시 들어오면 요약을 새로 만들지 않고 `skipped_duplicate` 상태로 기록한 뒤 `watch/processed/`로 이동합니다.

watch 처리 후 최신 요약 확인:

- `/watch` 페이지의 “최근 처리 결과” 카드에서 최신 요약 날짜와 “최신 요약 보기” 버튼을 확인합니다.
- 홈 화면의 “최근 처리된 요약” 카드에서도 최근 처리 파일과 최신 요약 바로가기를 확인할 수 있습니다.
- 성공한 watch 처리에서 여러 날짜 요약이 생성되면 가장 최신 날짜의 상세 페이지로 연결합니다.

watch 처리 완료 후 브라우저 자동 열기:

```env
OPEN_SUMMARY_AFTER_WATCH=true
```

이 값을 `.env`에 설정하면 watch 처리 성공 후 최신 요약 페이지를 기본 브라우저로 엽니다. 자동 열기에 실패해도 서버 처리는 계속됩니다. 기본값은 `false`입니다.

## 현재 주요 기능

- 카카오톡 TXT 파일 업로드
- 날짜 구분선 인식 및 날짜별 메시지 그룹화
- 작성자, 시간, 메시지 본문 파싱
- 여러 줄 메시지 병합
- 사진, 동영상, 이모티콘, 삭제 메시지, 시스템/입장/퇴장 메시지 제외
- 파싱 실패 줄 샘플 저장 및 업로드 결과 화면 표시
- 티커와 한국어 종목 별칭 추출
- 종목, ETF/레버리지, 크립토, 매크로 카테고리 분류
- 날짜별 요약 목록 카드 UI
- 검색창으로 날짜, 한 줄 결론, 대표 종목, 시장 분위기 검색
- 필터 칩으로 종목, ETF/레버리지, 크립토, 매크로, 리스크 필터링
- 상세 리포트 페이지
- SECTION 01~06 리포트 구조
- 날짜별 Markdown 내보내기
- 날짜별 TOP 종목/자산 CSV 내보내기
- 전체 날짜 TOP 종목/자산 CSV 내보내기
- 선택형 Gemini 고급 요약
- 주의 사항 disclosure
- 용어 보기 details
- 로컬 `watch/` 폴더 자동 처리
- 처리 완료 파일과 실패 파일 분리 이동
- 감시 폴더 상태 페이지
- 업로드 메타데이터와 날짜별 요약 결과 저장

## 저장 위치

업로드 기록과 요약 결과는 다음 파일에 저장됩니다.

```text
data/store.json
```

저장되는 주요 정보:

- 원본 파일명
- 업로드 시간
- 처리 상태
- 감지 날짜 수
- 파싱 메시지 수
- 시스템/첨부 제외 메시지 수
- 파싱 실패 수와 샘플
- 날짜별 요약 결과
- 감시 폴더 처리 기록
- 감시 파일 해시, 크기, 수정 시간, 성공/실패 상태

원본 TXT 전체 파일을 별도 보관하지 않고, 파싱 결과와 요약 중심으로 저장합니다.

## 테스트

```bash
node --test
```

문법 확인:

```bash
node --check src/server.js
```

샘플 파일은 다음 위치에 있습니다.

```text
samples/kakaotalk_sample.txt
```

## 현재 한계

- 요약은 LLM이 아닌 규칙 기반 요약입니다.
- Gemini 고급 요약은 환경변수로 켠 경우에만 추가 생성됩니다.
- Gemini 호출 실패나 JSON 파싱 실패가 있어도 규칙 기반 요약은 저장됩니다.
- 카카오톡 자동 수집 기능은 지원하지 않습니다. `watch/` 기능은 로컬 폴더 기반 자동 처리일 뿐입니다.
- 카카오톡 크롤링, 보안 우회, 비공식 자동 읽기 기능은 포함하지 않습니다.
- 이 결과는 실제 투자 조언이 아니라 채팅방 대화 요약입니다.
- 카카오톡 TXT 내보내기 형식이 달라지면 파서 보강이 필요할 수 있습니다.
- 티커/별칭 추출은 사전과 정규식 기반이므로 오탐 또는 누락이 있을 수 있습니다.

## 다음 단계 후보

- LLM 요약 API 연동
- 매일 자동 실행 또는 스케줄링
- 파일 감시 폴더 방식 업로드
- 내보내기 파일 템플릿 커스터마이징
- 원문 근거 메시지 보기
- 시간대 필터
- 티커/한국어 별칭 사전 확장
- 업로드 기록과 날짜별 대표 요약을 분리한 관리 화면

## 자동 수집 기능을 붙일 위치

자동 수집은 현재 MVP 범위에서 제외되어 있습니다. 나중에 추가할 경우 카카오톡을 비공식적으로 크롤링하지 말고, 합법적인 입력 채널을 별도 ingestion 계층으로 추가하는 방식이 적합합니다.

권장 연결 방식:

- 새 ingestion 모듈이 TXT 문자열 또는 `{ date, time, author, text }` 형태의 메시지 배열을 생성
- `src/parser.js`의 파싱 결과 스키마와 호환되도록 변환
- `groupMessagesByDate()`, `generateDailySummary()`, `storage.saveUploadResult()` 흐름에 연결
