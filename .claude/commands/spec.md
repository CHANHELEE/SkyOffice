---
description: Notion 스펙(TASK/MVP) 을 읽고 해당 작업 항목을 구현
argument-hint: [작업 항목 또는 키워드]
---

## 1. 스펙 읽기

아래를 모두 읽어라. 하위 페이지·토글도 펼쳐서 읽는다.

- TASK 보드 (이 저장소 기준):
  `mcp__notion__notion-fetch` → https://app.notion.com/p/3c49430ebf628055a51ec12ef86f7355
  `mcp__notion__notion-query-data-sources` → `collection://3c49430e-bf62-80b1-b70e-000bcc96c9cf`
- MVP 기능 범위:
  `mcp__notion__notion-query-data-sources` → `collection://3bc9430e-bf62-80e3-adc5-000b7bf4cf53`
- 배경/의사결정이 필요하면 PRD:
  `mcp__notion__notion-fetch` → https://app.notion.com/p/3b39430ebf6280c48565eeb66a6eeff9

## 2. 대상 선정

$ARGUMENTS 에 해당하는 미완료 항목을 고른다.
- 인자가 비어 있으면 미완료 항목 목록을 요약해서 보여주고 어떤 걸 할지 물어본다.
- 인자가 여러 항목에 매칭되면 후보를 제시하고 확인받는다.
- MVP 컬럼이 `X` 또는 `2차 이후`인 항목은 사용자가 명시적으로 지정하지 않는 한 건드리지 않는다.

## 3. 구현

- Notion에 적힌 요구사항만 구현한다. 문서에 없는 기능은 임의 추가하지 말고 먼저 제안한다.
- 문서와 현재 코드가 어긋나면 Notion을 기준으로 하되, 차이점을 보고한다.
- 브랜치는 `feat/<항목-슬러그>` 로 만든다. 이미 feat 브랜치 위라면 그대로 이어서 작업한다.
- 서버 상태 변경은 `server/rooms/commands/`, 공용 타입은 `types/` 에 반영한다.

## 4. 검증

- `cd client && yarn build` (타입체크 포함) 로 빌드가 깨지지 않는지 확인한다.
- 실행 확인이 필요하면 서버(`yarn start`)와 클라이언트(`cd client && yarn dev`)를 띄워 확인한다.
- 검증 결과를 실제 출력과 함께 보고한다. 확인하지 않은 것을 "된다"고 말하지 않는다.

## 5. 마무리

- 무엇을 구현했고 Notion의 어느 항목에 대응하는지 요약해서 보고한다.
- 사용자가 승인하면 `mcp__notion__notion-update-page` 로 해당 TASK 상태를 완료 처리한다.
  (승인 없이 Notion을 수정하지 않는다.)
