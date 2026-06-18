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
      1-pick-question.js     # 고정 질문 풀에서 선택 + Claude API로 문구 다듬기/BGM 장르 태깅
      2-record-video.js      # Playwright + ffmpeg 화면 녹화 (Universal Waite → Lenormand → Oracle Belline)
      3-edit-video.js        # ffmpeg 자막/효과음 합성 (캐치프레이즈도 Claude API로 생성)
      4-upload-youtube.js    # YouTube 업로드 + 비공개 후 예약 공개
    utils/                  # 공용 설정(config.js)/Claude 클라이언트(anthropic.js)
    run-pipeline.js          # 전체 파이프라인 순차 실행
  assets/
    sfx/flip.mp3            # 카드 뒤집는 효과음 (직접 추가, 파일명 고정: flip.mp3)
    bgm/                    # 분위기별 배경음악 (직접 추가). 파일명에 장르 키워드를 포함
                             # 시키면 자동 매칭됨 (예: mystic-1.mp3, lofi-night.mp3)
  data/
    questions-pool.json      # 카테고리별 고정 질문 풀 (직접 추가/수정 가능)
    current-question.json    # 1단계 실행 결과 (다음 단계가 읽음)
  output/
    recordings/             # 2단계 원본 녹화본
    final/                  # 3단계 편집 완료본 (업로드 대상)
```

## 진행 방식

- 트렌드 API 대신 `data/questions-pool.json`에 미리 넣어둔 질문 풀에서 매번 하나를 골라, Claude API로 문구를 다듬고 분위기에 맞는 배경음악 장르를 태깅합니다 (1단계).
- 각 단계는 `npm run step1:question` 처럼 독립 실행 가능하며, `data/`에 결과를 JSON으로 저장해 다음 단계가 읽습니다. 전체는 `npm run pipeline`으로 순서대로 실행합니다.

현재 상태: 1~3단계 구현 완료 (질문 선정 → 녹화 → 자막/효과음/배경음 합성). 다음은 4단계(YouTube 업로드) 구현.

## 3단계 (영상 편집) 참고사항

- 자막 폰트: 기본값은 Windows 맑은 고딕(`C:/Windows/Fonts/malgunbd.ttf`). 다른 폰트를 쓰려면 `.env`에 `SUBTITLE_FONT_PATH` 지정.
- 효과음 파일은 정확히 `assets/sfx/flip.mp3` 경로에 있어야 카드 플립 시점에 자동으로 삽입됨 (없으면 효과음 없이 진행).
- 배경음악은 `assets/bgm/` 폴더에 넣어두고, 1단계가 고른 `bgmGenre`(예: "lofi chill")의 첫 단어가 파일명에 포함되면 자동으로 골라 씀 (없으면 배경음악 없이 진행).
