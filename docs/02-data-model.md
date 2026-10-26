# 02. 데이터 모델 초안 (MVP)

작성일: 2026-10-26 · 상태: **초안, 오너 검토 대기**

> ⚠️ **출시 전 법률 확인 필요**: 연애 사연·연령·성별·생년월일시 수집, 원문/변환본 보관 기간, 신고 데이터 처리, 만 14세 미만 가입 처리, 약관의 "톤 수정 동의" 문구는 개인정보보호법·정보통신망법 기준으로 전문가 검토를 받아야 한다. 이 문서의 보관 기간·권한 설계는 기술 초안일 뿐 법적 판단이 아니다.

DB 종류가 아직 정해지지 않아서 PostgreSQL 기준으로 썼다. 권장안은 Supabase(Postgres + 인증 + 행 단위 접근 제어)이고, 아래 "공개 / 비공개" 구분은 그대로 RLS 정책이 된다.

## 설계 원칙

1. **공개 테이블과 비공개 테이블을 나눈다.** 다른 사용자에게 보이는 테이블에는 작성자 계정 ID를 노출하지 않는다. 화면에는 `30대 · 여성` 같은 연령대·성별만 나간다. 댓글 원문, 신고 내용, 작성자 매핑은 비공개 테이블에 두고 서버(서비스 키)와 권한 있는 운영자만 읽는다.
2. **필요 없는 원본은 저장하지 않는다.** 게시글 초안을 만들 때 쓴 사용자의 원래 고민(실명·회사명이 들어있을 수 있음)은 게시 후 삭제한다. 보관하는 원본은 기획상 필요한 "댓글 원문/변환본" 하나뿐이다.
3. **연령대·성별은 작성 시점에 스냅샷으로 박는다.** 프로필을 바꿔도 과거 댓글의 표시와 의견 분포 통계가 흔들리지 않는다.
4. **크레딧은 잔액이 아니라 원장(ledger)으로 기록한다.** 모든 증감을 한 줄씩 쌓고, 같은 사유로 두 번 지급되지 않게 유일키를 건다.
5. **바꿀 수 없는 값은 DB가 막는다.** 게시글 톤, 원래 질문은 게시 후 수정 불가(트리거).

## 전체 구조

```
users ─┬─< readings ──(선택)── post_drafts ──게시──> posts ─┬─< comments
       │                                                    │      │
       │                                                    │      └─1 comment_texts (비공개: 원문/변환본)
       ├─< comment_previews (임시, 톤 변환 미리보기)        │
       ├─< credit_ledger                                    └─< helpful_marks
       ├─< reports ─── moderation_actions
       └─< blocks
                                   admin_access_log (비공개 데이터 열람 기록)
```

## 테이블

### `users` — 비공개
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid PK | 인증 서비스의 사용자 ID |
| age_band | enum `age_band` | `20s`, `30s`, `40s`, `50s`, `60_plus`. 생년월일은 저장하지 않는다. |
| gender | enum `gender` | `female`, `male`, `other`, `undisclosed` |
| age_band_locked_at | timestamptz | 연령대 최초 설정 시각. 이후 변경은 고객센터 경유(가중 크레딧 노리고 연령 바꾸는 것 방지) |
| status | enum | `active`, `suspended`, `deleted` |
| terms_version | text | 동의한 약관 버전 (톤 수정 동의 포함) |
| privacy_version | text | 동의한 개인정보 처리방침 버전 |
| created_at, deleted_at | timestamptz | 탈퇴 시 `deleted_at` 기록 후 개인 식별 필드 파기 |

- 닉네임을 두지 않는다. 화면 표시는 연령대·성별뿐이고, 같은 글 안에서 글쓴이 본인이 댓글을 달면 "작성자"로 표시한다.
- 로그인 수단(이메일·소셜 ID)은 인증 서비스 쪽 테이블에만 있다.
- **확인 필요**: 10대 가입 허용 여부. 연애 고민 커뮤니티 특성상 만 19세 이상(또는 최소 만 14세 이상)으로 제한하는 안을 권장.

### `readings` — 비공개 (본인만)
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK → users | |
| kind | enum | `tarot`, `saju` |
| tier | enum | `basic`, `deep` |
| question | text | 사용자가 입력한 질문 |
| cards | jsonb | 뽑은 카드와 방향 (현재 `buildSnapshot()` 구조) |
| result | jsonb | AI 리딩 결과 |
| credit_ledger_id | uuid FK, null | 심층 리딩에 크레딧을 쓴 경우 그 원장 행 |
| prompt_version | text | 사용한 프롬프트 버전 |
| created_at | timestamptz | |

- 지금은 리딩 기록이 브라우저 `localStorage`에만 있다. 게시와 크레딧 차감을 위해 서버 저장이 필요하다. 기존 로컬 기록은 그대로 두고, 로그인 후 새 리딩부터 서버에 저장한다.
- 사주(Phase 1 이후): 생년월일시는 프로필에 저장하지 않고 리딩 요청 때만 받는 안을 권장. 저장이 필요하면 별도 동의 + 암호화 컬럼.

### `post_drafts` — 비공개 (본인만), 임시
AI 익명 초안 작성 단계. 게시하면 삭제, 미게시는 24시간 후 삭제.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| reading_id | uuid FK | 어떤 리딩에서 시작했는지 |
| source_text | text | 사용자가 쓴 원래 고민 (실명 등 포함 가능) |
| question_text | text | 원래 질문. AI가 바꾸지 않는다. |
| ai_title, ai_body | text | AI 초안 |
| redactions | jsonb | `[{type:"name", from:"민수", to:"그 사람"}, ...]` 작성자 확인용 |
| prompt_version | text | |
| expires_at | timestamptz | 기본 now() + 24h |

### `posts` — 공개
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid PK | |
| author_id | uuid FK | **공개 조회 뷰(`posts_public`)에서는 제외** |
| reading_id | uuid FK, null | 비공개. 리딩 카드를 글에 붙일지는 작성자 선택(`show_cards`) |
| show_cards | bool | 카드 배열 공개 여부 |
| title, body | text | 작성자가 확인·수정한 최종본 |
| question_text | text | 원래 질문. **수정 불가** |
| tone | enum `post_tone` | `soft`(부드럽게), `raw`(원문 그대로). **수정 불가** |
| author_age_band, author_gender | enum | 게시 시점 스냅샷 (표시 여부는 디자인 단계에서 결정) |
| category | text, null | MVP 이후 태깅용 (연애/직장/금전…) |
| status | enum | `published`, `hidden_by_author`, `hidden_pending_review`, `removed`, `deleted` |
| comment_count | int | 캐시 |
| created_at, updated_at | timestamptz | |

### `comments` — 공개
화면에 실제로 나가는 댓글. 원문은 여기 두지 않는다.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid PK | |
| post_id | uuid FK | |
| author_id | uuid FK | **공개 뷰에서 제외** |
| body | text | 게시된 문장 (soft 글이면 변환본, raw 글이면 원문) |
| was_transformed | bool | 톤 변환을 거쳤는지. 화면에 "톤 조정됨" 표시 여부는 디자인 결정 |
| author_age_band, author_gender | enum | 작성 시점 스냅샷 |
| is_post_author | bool | 글쓴이 본인의 댓글이면 "작성자" 표시 |
| status | enum | `published`, `hidden_pending_review`, `removed`, `deleted` |
| created_at | timestamptz | |

### `comment_texts` — 비공개 (서버·운영자만)
분쟁 대응용 원문/변환본 보관. 일반 사용자는 본인 것도 API로 읽지 않는다(본인은 미리보기 단계에서 이미 봤음).

| 컬럼 | 타입 | 설명 |
|---|---|---|
| comment_id | uuid PK/FK | |
| original_text | text | 작성자가 쓴 원문 |
| transformed_text | text, null | AI 변환본 (raw 글이면 null) |
| filter_hits | jsonb | 금칙어 필터에 걸린 항목 |
| model, prompt_version | text | 어떤 모델·프롬프트로 변환했는지 |
| stance_check | jsonb | 변환 전후 입장 강도 자체 점검 결과 (`prompts/comment-tone-soft.md`) |
| purge_after | timestamptz | 보관 기한. **기간은 법률 확인 후 확정** (초안: 1년) |

### `comment_previews` — 비공개 (본인만), 임시
"쓰기 → 변환본 확인 → 게시" 흐름을 서버가 쥐기 위한 테이블. 클라이언트가 변환본을 직접 보내게 하면 변환을 건너뛰고 아무 문장이나 게시할 수 있으므로, 게시 API는 `preview_id`만 받는다.

| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid PK | |
| user_id, post_id | uuid FK | |
| original_text, transformed_text | text | |
| filter_hits, stance_check | jsonb | |
| expires_at | timestamptz | 30분. 게시하면 `comments` + `comment_texts`로 옮기고 삭제 |

- 작성자가 변환본이 마음에 안 들면 원문을 고쳐 다시 미리보기를 요청한다(변환본을 직접 고치는 기능은 두지 않음 — 고친 문장이 다시 무례해질 수 있어서). **오너 확인 필요.**

### `helpful_marks` — 비공개
| 컬럼 | 타입 | 설명 |
|---|---|---|
| comment_id | uuid PK/FK | 댓글당 1회 |
| post_id | uuid FK | |
| marked_by | uuid FK | 글쓴이만 누를 수 있음 (서버에서 확인) |
| created_at | timestamptz | |

- 글쓴이가 자기 댓글에는 못 누른다.
- 부정 사용 방지 초안: 글 하나당 "도움됐어요" 최대 N개(예: 5), 같은 답변자에게 한 사람이 주는 크레딧은 월 M회까지.

### `credit_ledger` — 비공개 (본인은 자기 내역만)
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK | |
| delta | int | +1 지급, −1 사용 |
| reason | enum | `helpful_answer`, `age_diversity_bonus`, `deep_reading`, `purchase`, `admin_adjust`, `revoked` |
| ref_type, ref_id | text, uuid | 근거 (helpful_mark의 comment_id, reading_id 등) |
| created_at | timestamptz | |
| UNIQUE (reason, ref_type, ref_id) | | 같은 근거로 중복 지급 방지 |

- 잔액은 `SUM(delta)`(뷰 `credit_balances`). 차감은 트랜잭션 안에서 잔액 확인 후 기록.
- 신고로 답변이 삭제되면 지급된 크레딧은 `revoked` 행으로 회수.
- 가중 크레딧(`age_diversity_bonus`)은 MVP에서는 스키마만 두고 꺼둔다.

### `reports` — 비공개 (신고자는 본인 신고 상태만, 운영자 전체)
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid PK | |
| reporter_id | uuid FK | |
| target_type | enum | `post`, `comment` |
| target_id | uuid | |
| reason | enum | `abuse`(욕설·인신공격), `personal_info`(개인정보 노출), `spam_promo`, `sexual`, `self_harm`(위기 신호), `other` |
| detail | text, null | 500자 제한 |
| status | enum | `open`, `reviewing`, `actioned`, `dismissed` |
| handled_by | uuid FK, null | 운영자 |
| handled_at | timestamptz | |
| created_at | timestamptz | |
| UNIQUE (reporter_id, target_type, target_id) | | 중복 신고 방지 |

- 같은 대상에 신고가 K건(초안: 3) 쌓이면 자동으로 `hidden_pending_review`.
- `personal_info`, `self_harm` 신고는 1건만으로도 즉시 운영자 알림.

### `moderation_actions` — 비공개 (운영자만)
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | uuid PK | |
| moderator_id | uuid FK | |
| target_type, target_id | | post / comment / user |
| action | enum | `hide`, `restore`, `remove`, `warn`, `suspend`, `unsuspend` |
| report_id | uuid FK, null | |
| note | text | |
| created_at | timestamptz | |

### `blocks` — 비공개
| 컬럼 | 타입 | 설명 |
|---|---|---|
| blocker_id | uuid FK | |
| blocked_id | uuid FK | |
| created_at | timestamptz | |
| PK (blocker_id, blocked_id) | | |

- 익명이므로 사용자는 상대 ID를 모른다. 차단 API는 `comment_id`나 `post_id`를 받아 서버가 작성자를 찾는다. 응답에 상대 ID를 돌려주지 않는다.
- 차단하면 서로의 글·댓글이 보이지 않는다(목록 조회 시 서버에서 제외).

### `admin_access_log` — 비공개 (추가만 가능)
| 컬럼 | 타입 | 설명 |
|---|---|---|
| id | bigserial PK | |
| admin_id | uuid | |
| resource | text | `comment_texts`, `reports`, `users` 등 |
| resource_id | uuid | |
| purpose | text | 열람 사유 (신고 처리 번호 등) |
| created_at | timestamptz | |

- 운영자가 댓글 원문이나 작성자 매핑을 볼 때마다 기록한다. `/cso` 점검 대상.

## SQL 초안

```sql
create type age_band   as enum ('20s','30s','40s','50s','60_plus');
create type gender     as enum ('female','male','other','undisclosed');
create type post_tone  as enum ('soft','raw');
create type content_status as enum ('published','hidden_by_author','hidden_pending_review','removed','deleted');

create table users (
  id uuid primary key,
  age_band age_band not null,
  gender gender not null,
  age_band_locked_at timestamptz not null default now(),
  status text not null default 'active' check (status in ('active','suspended','deleted')),
  terms_version text not null,
  privacy_version text not null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table readings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  kind text not null check (kind in ('tarot','saju')),
  tier text not null check (tier in ('basic','deep')),
  question text,
  cards jsonb not null,
  result jsonb,
  credit_ledger_id uuid,
  prompt_version text not null,
  created_at timestamptz not null default now()
);

create table post_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  reading_id uuid references readings(id),
  source_text text not null,
  question_text text not null,
  ai_title text,
  ai_body text,
  redactions jsonb not null default '[]',
  prompt_version text not null,
  expires_at timestamptz not null default now() + interval '24 hours'
);

create table posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references users(id),
  reading_id uuid references readings(id),
  show_cards boolean not null default false,
  title text not null check (char_length(title) <= 80),
  body text not null check (char_length(body) <= 3000),
  question_text text not null,
  tone post_tone not null,
  author_age_band age_band not null,
  author_gender gender not null,
  category text,
  status content_status not null default 'published',
  comment_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 톤과 원래 질문은 게시 후 변경 불가
create function forbid_post_immutable_change() returns trigger as $$
begin
  if new.tone is distinct from old.tone or new.question_text is distinct from old.question_text then
    raise exception 'tone and question_text are immutable';
  end if;
  return new;
end $$ language plpgsql;
create trigger posts_immutable before update on posts
  for each row execute function forbid_post_immutable_change();

create table comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id),
  author_id uuid not null references users(id),
  body text not null check (char_length(body) <= 1000),
  was_transformed boolean not null,
  author_age_band age_band not null,
  author_gender gender not null,
  is_post_author boolean not null default false,
  status content_status not null default 'published',
  created_at timestamptz not null default now()
);
create index on comments (post_id, created_at);

create table comment_texts (
  comment_id uuid primary key references comments(id),
  original_text text not null,
  transformed_text text,
  filter_hits jsonb not null default '[]',
  model text,
  prompt_version text,
  stance_check jsonb,
  purge_after timestamptz not null  -- 기간은 법률 확인 후 확정
);

create table comment_previews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  post_id uuid not null references posts(id),
  original_text text not null,
  transformed_text text,
  filter_hits jsonb not null default '[]',
  stance_check jsonb,
  expires_at timestamptz not null default now() + interval '30 minutes'
);

create table helpful_marks (
  comment_id uuid primary key references comments(id),
  post_id uuid not null references posts(id),
  marked_by uuid not null references users(id),
  created_at timestamptz not null default now()
);

create table credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  delta int not null check (delta <> 0),
  reason text not null check (reason in
    ('helpful_answer','age_diversity_bonus','deep_reading','purchase','admin_adjust','revoked')),
  ref_type text,
  ref_id uuid,
  created_at timestamptz not null default now(),
  unique (reason, ref_type, ref_id)
);
create view credit_balances as
  select user_id, sum(delta)::int as balance from credit_ledger group by user_id;

create table reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references users(id),
  target_type text not null check (target_type in ('post','comment')),
  target_id uuid not null,
  reason text not null check (reason in
    ('abuse','personal_info','spam_promo','sexual','self_harm','other')),
  detail text check (char_length(detail) <= 500),
  status text not null default 'open' check (status in ('open','reviewing','actioned','dismissed')),
  handled_by uuid references users(id),
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  unique (reporter_id, target_type, target_id)
);

create table moderation_actions (
  id uuid primary key default gen_random_uuid(),
  moderator_id uuid not null references users(id),
  target_type text not null check (target_type in ('post','comment','user')),
  target_id uuid not null,
  action text not null check (action in ('hide','restore','remove','warn','suspend','unsuspend')),
  report_id uuid references reports(id),
  note text,
  created_at timestamptz not null default now()
);

create table blocks (
  blocker_id uuid not null references users(id),
  blocked_id uuid not null references users(id),
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table admin_access_log (
  id bigserial primary key,
  admin_id uuid not null,
  resource text not null,
  resource_id uuid,
  purpose text not null,
  created_at timestamptz not null default now()
);

-- 다른 사용자에게 보여주는 조회용 뷰: author_id를 내보내지 않는다
create view posts_public as
  select id, title, body, question_text, tone, author_age_band, author_gender,
         category, comment_count, created_at
  from posts where status = 'published';
create view comments_public as
  select id, post_id, body, was_transformed, author_age_band, author_gender,
         is_post_author, created_at
  from comments where status = 'published';
```

## 접근 권한 요약 (RLS 초안)

| 테이블 | 본인 | 다른 사용자 | 운영자 | 서버(서비스 키) |
|---|---|---|---|---|
| users | 읽기·일부 수정 | ✕ | 읽기(로그) | 전체 |
| readings, post_drafts, comment_previews | 읽기·쓰기 | ✕ | ✕ | 전체 |
| posts / comments | 공개 뷰 + 본인 글 숨김·삭제 | 공개 뷰만 | 전체(로그) | 전체 |
| comment_texts | ✕ | ✕ | 읽기(로그 필수) | 쓰기 |
| helpful_marks | 본인이 누른 것 | ✕ | 읽기 | 쓰기 |
| credit_ledger | 본인 내역 읽기 | ✕ | 읽기 | 쓰기(사용자 직접 쓰기 금지) |
| reports | 본인 신고 생성·상태 확인 | ✕ | 전체(로그) | 전체 |
| blocks | 본인 것 | ✕ | 읽기 | 전체 |
| admin_access_log | ✕ | ✕ | 추가만 | 추가만 |

## 의견 분포 요약(MVP 이후)을 위한 준비
- 댓글에 연령대 스냅샷이 있으므로 분포 계산은 가능하다. "기다려보라 / 연락해보라" 같은 입장 분류는 나중에 `comment_stances(comment_id, stance_label, model, prompt_version)` 테이블을 추가해 AI로 분류한다. MVP 스키마는 건드리지 않아도 된다.

## 오너 확인이 필요한 결정
1. DB·인증: Supabase 권장 (대안: Vercel Postgres + 별도 인증)
2. 가입 연령 하한 (만 14세 / 만 19세)
3. 게시글에 작성자 연령대·성별을 보여줄지
4. 댓글 변환본을 작성자가 직접 고칠 수 있게 할지 (초안: 불가, 원문을 고쳐 재변환)
5. 댓글 원문/변환본 보관 기간 (초안: 1년, 법률 확인 후 확정)
6. "도움됐어요" 상한 (초안: 글당 5개)
