# Starlight Tarot Automation Pipeline

Windows 로컬에서 실행하는 자동화 파이프라인: 트렌드 키워드 수집 → 타로 질문 생성 → 화면 녹화 → 영상 편집 → 유튜브 쇼츠 업로드(24시간 후 공개 예약).

## 사전 준비 (Windows)

1. Node.js 18+ 설치
2. ffmpeg 설치 (https://www.gyan.dev/ffmpeg/builds/ 권장) 후 PATH 등록, 또는 `.env`의 `FFMPEG_PATH`에 `ffmpeg.exe` 전체 경로 지정
3. 이 폴더(`automation/`)에서:
   ```
   npm install
   npx playwright install chromium
   ```
4. `.env.example`을 `.env`로 복사하고 값 채우기
   - `ANTHROPIC_API_KEY`: Claude API 키
   - `YOUTUBE_API_KEY` / OAuth 클라이언트 정보: Google Cloud Console에서 YouTube Data API v3 사용 설정 후 발급
   - 업로드(쓰기)는 API Key만으로는 안 되고 OAuth2 (client id/secret + refresh token)가 필요함 — 이건 5단계 구현 시 별도 인증 스크립트로 발급 안내 예정

## 폴더 구조

```
automation/
  src/
    steps/
      1-fetch-trends.js     # YouTube Data API로 트렌드 키워드 수집
      2-generate-question.js # Claude API로 타로 질문 생성
      3-record-video.js      # Playwright + ffmpeg 화면 녹화 (Universal Waite → Lenormand → Oracle Belline)
      4-edit-video.js        # ffmpeg 자막/효과음 합성
      5-upload-youtube.js    # YouTube 업로드 + 비공개 후 예약 공개
    utils/                  # 공용 설정/로거/ffmpeg 헬퍼
    run-pipeline.js          # 전체 파이프라인 순차 실행
  assets/
    sfx/                    # 카드 뒤집는 효과음 (직접 추가)
    bgm/                    # 분위기별 배경음악 (직접 추가, 장르별 하위 폴더 권장)
  data/                     # 단계 간 전달용 중간 JSON (트렌드, 질문, 캐치프레이즈 등)
  output/
    recordings/             # 3단계 원본 녹화본
    final/                  # 4단계 편집 완료본 (업로드 대상)
```

## 진행 방식

각 단계는 `npm run step1:trends` 처럼 독립 실행 가능하며, `data/`에 결과를 JSON으로 저장해 다음 단계가 읽습니다. 전체는 `npm run pipeline`으로 순서대로 실행합니다.

현재 상태: 폴더 구조와 의존성 설치 완료. 다음 단계부터 `src/steps/*.js` 구현 진행.
