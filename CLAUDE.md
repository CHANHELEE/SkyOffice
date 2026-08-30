# CLAUDE.md

이 저장소는 **igloo** 스터디 모임 서비스의 메타버스 파트(SkyOffice 포크)입니다.
Colyseus(서버) + Phaser 3 / React(클라이언트) 기반의 실시간 가상 오피스입니다.

## 스펙 소스 오브 트루스

이 프로젝트의 요구사항은 아래 Notion 페이지가 **유일한 기준**입니다.

| 문서 | URL | 용도 |
| --- | --- | --- |
| igloo (루트) | https://app.notion.com/p/3b39430ebf6280e4a29fcace945b3e73 | 하위 문서 인덱스 |
| 1️⃣ igloo - PRD | https://app.notion.com/p/3b39430ebf6280c48565eeb66a6eeff9 | 전체 요구사항·의사결정 로그 |
| 2️⃣ igloo - MVP 기능 범위 | https://app.notion.com/p/3bc9430ebf6280ccb417c03d59e54bc9 | 기능별 MVP 포함 여부 / 완료 상태 |
| 3️⃣ igloo-skyoffice | https://app.notion.com/p/3c49430ebf628055a51ec12ef86f7355 | **이 저장소 전용 TASK 보드** |

### 작업 규칙

1. 작업 시작 전 반드시 `mcp__notion__notion-fetch`로 위 페이지를 읽는다.
   이 저장소 작업은 **3️⃣ igloo-skyoffice**의 TASK DB가 1차 기준이고,
   배경/의도가 필요하면 1️⃣ PRD와 2️⃣ MVP 범위를 참조한다.
2. TASK DB는 `mcp__notion__notion-query-data-sources`로 조회한다.
   - data source: `collection://3c49430e-bf62-80b1-b70e-000bcc96c9cf`
   - 컬럼: `이름`, `상세 구현 내용`, `선택`(상태: 대기중 등)
3. MVP 범위 DB data source: `collection://3bc9430e-bf62-80e3-adc5-000b7bf4cf53`
   (`기능`, `링크`, `MVP`, `기능생성완료`, `페이지 생성완료`)
4. 코드와 문서가 어긋나면 **Notion 페이지를 기준**으로 하고, 차이점을 사용자에게 보고한다.
5. Notion에 없는 요구사항을 임의로 추가하지 않는다. 필요하다고 판단되면 먼저 제안하고 승인받는다.
6. 작업을 완료하면 해당 TASK의 상태를 `mcp__notion__notion-update-page`로 갱신한다.
   (사용자가 명시적으로 요청했을 때만 Notion을 수정한다.)

### PRD에서 확정된 이 저장소 관련 결정사항

- SkyOffice는 **이글루 전용 방**만 사용한다 (외부인 접근 차단).
- 이글루 웹 서버로 이동 가능한 링크를 제공한다.
- 채팅 기능은 이미 존재한다 (추가 개발 불필요).
- **달리기 등 이동 기능 확장**은 오픈소스 수정이 필요한 항목으로 확정됨 (MIT 라이선스, 수정·배포 가능).
- 공간 분리(구역별 대화 / 토론 공간) 기능은 2차 범위.
- 호스팅 비용은 최소화한다. SkyOffice는 무료 호스팅 전제.
- 데스크탑 우선이지만 모바일에서도 동작해야 한다 (반응형·가상 조이스틱 유지).

## 브랜치 / 커밋 규칙

- 모든 작업 브랜치는 `feat/` 하위에 만든다. 예: `feat/run-movement`, `feat/private-room`
- 그 외 접두사: `fix/`, `chore/`, `refactor/`
- `master`에 직접 커밋하지 않는다.

## 프로젝트 구조

```
server/            Colyseus 게임 서버 (TypeScript)
  index.ts         서버 엔트리포인트
  rooms/SkyOffice.ts  메인 Room 정의
  rooms/commands/  @colyseus/command 단위 액션
  rooms/schema/    동기화되는 상태 스키마
client/src/
  scenes/          Phaser 씬 (Game, Bootstrap 등)
  characters/      플레이어/타 플레이어 스프라이트
  items/           상호작용 오브젝트 (화이트보드, 컴퓨터, 의자 등)
  components/      React UI (MUI + styled-components)
  stores/          Redux Toolkit 상태
  services/        Colyseus 클라이언트 네트워크 레이어
  web/             PeerJS 기반 화상/화면공유
types/             서버·클라이언트 공용 타입 (별도 package)
```

## 개발 명령어

```bash
# 최초 1회: .env 준비 (gitignore 되어 있다)
cp .env.example .env                    # SUPABASE_* 값을 채운다
cp client/.env.example client/.env.local

# 서버 (루트에서). SUPABASE_* 없이는 부팅이 실패한다.
yarn
yarn start                  # ts-node-dev, 기본 2567 포트

# 클라이언트
cd client && yarn && yarn dev   # vite dev server
cd client && yarn build         # tsc + vite build
```

### 환경변수

서버 (루트 `.env`)

| 이름 | 필수 | 설명 |
| --- | --- | --- |
| `SUPABASE_URL` | O | 이글루 웹이 쓰는 Supabase 프로젝트 URL. 없으면 서버가 부팅되지 않는다 |
| `SUPABASE_PUBLISHABLE_KEY` | O | publishable(anon) 키. **service_role 키를 여기 두지 않는다** |
| `PORT` | X | 게임 서버 포트 (기본 2567) |

클라이언트 (`client/.env.local`, Vite 는 `VITE_` 접두사만 노출한다)

| 이름 | 필수 | 설명 |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | O | 위와 같은 프로젝트 |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | O | 위와 같은 키 |
| `VITE_COOKIE_DOMAIN` | X | 운영은 `.myigloos.com`. **로컬은 비운다** (localhost 에 도메인을 붙이면 쿠키가 버려진다) |
| `VITE_IGLOO_WEB_URL` | X | 이글루 웹 주소 (기본 `https://www.myigloos.com`) |
| `VITE_SERVER_URL` | X | 운영 빌드에서만 읽는 Colyseus 주소 |

로컬에서는 루트의 `.env`를 `dotenv`가 읽는다 (`server/index.ts`). `.env` 경로는 cwd가 아니라
파일 위치 기준으로 잡혀 있다 — `yarn start`는 `server/`에서, Procfile은 루트에서 돌기 때문이다.
배포 환경에는 `.env`를 두지 말고 실제 환경변수를 주입한다.

`types/`는 별도 패키지이므로 타입을 수정하면 서버·클라이언트 양쪽에서 다시 설치/빌드가 필요할 수 있다.

## 로그인 / 인증

입장은 **이글루 계정(카카오 OAuth + Supabase)** 으로만 가능하다. 공용 비밀번호 입장은 없앴다.

- 세션 쿠키를 `.myigloos.com` 에 걸어 이글루 웹(`www.myigloos.com`)과 메타버스
  (`www.metabus.myigloos.com`)가 **같은 세션을 공유**한다. 어느 쪽에서 로그인하든 반대쪽이 알아본다.
  그래서 클라이언트는 `@supabase/supabase-js` 가 아니라 **`@supabase/ssr` 의 `createBrowserClient`** 를 쓴다
  (localStorage 는 오리진마다 격리되어 세션을 공유할 수 없다). 이글루 웹과 **같은 메이저 버전**을 유지해야 한다.
- 서버는 `server/iglooAuth.ts` 에서 두 가지를 확인한다. **둘 다 필요하다.**
  1. 토큰이 진짜인가 (`GET /auth/v1/user`)
  2. 이글루 명단에 있고 지금 참여 중인가 (`POST /rest/v1/rpc/my_status`)

  카카오로 로그인만 하면 누구나 유효한 토큰을 받는다. 2번이 빠지면 명단과 무관한 사람이 들어온다.
- 모든 조회는 **사용자 본인의 토큰**으로 나가므로 RLS 가 그대로 적용된다. 게임 서버에 service_role 키를 주지 않는다.
- 방 안의 이름은 서버가 명단에서 정한다. 클라이언트가 보내는 이름은 **무시한다** (사칭 방지).
- 거절 사유는 `types/Auth.ts` 의 `AuthFailure` 코드로 구분해 전달한다. 입장 화면이 이 코드로 안내 문구와
  이동할 곳을 정하므로, 새 사유가 생기면 여기에 추가한다.

## 코드 컨벤션

- TypeScript strict. 새 상태를 서버에서 동기화하려면 `rooms/schema`와 `types/IOfficeState.ts`를 함께 수정한다.
- 서버 상태 변경은 Room 안에서 직접 조작하지 말고 `rooms/commands/`의 Command로 분리한다.
- 클라이언트↔서버 메시지 타입은 `types/Messages.ts`에 추가한다.
- 업스트림(kevinshen56714/SkyOffice)과의 병합 가능성을 고려해 기존 파일 구조를 크게 바꾸지 않는다.
