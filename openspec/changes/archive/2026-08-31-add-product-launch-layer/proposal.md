# Add: Product Launch Layer

## Why

"돈이 되는 프로덕트 레벨"로 올리기 위한 출시 인프라: 방문자를 터미널로 데려오는 랜딩(마케팅 플랜의 "랜딩 한 장"), Bankr 부품 마지막 퍼즐인 웹훅, 과금 가시성(사용량 조회), 배포 패키징. 수익화 경로는 이미 구현된 x402 유료 API와 런치패드 수수료.

## What Changes

- 랜딩 페이지를 `/`로, 터미널을 `/terminal`로 이동 (훅 + 기능 그리드 + API 가격 + CTA)
- 웹훅 알림: `WEBHOOK_URL` 설정 시 체결 이벤트 POST (스왑/퍼펫/런치 매매)
- LLM 게이트웨이 사용량 조회 `/api/gateway/usage` (키 인증)
- 배포 패키징: Dockerfile + .dockerignore
- HTML 종합 리포트 `public/report.html`

## Capabilities

### New Capabilities

- `landing-page`: 훅 기반 랜딩과 터미널 라우팅 분리
- `webhooks`: 체결 이벤트 아웃바운드 웹훅

### Modified Capabilities

(없음 — 게이트웨이 usage 조회는 기존 llm-gateway 보조 엔드포인트)

## Impact

- 이동: `app/page.tsx` → `app/terminal/page.tsx`
- 신규: `app/page.tsx`(랜딩), `lib/webhook.ts`, `app/api/gateway/usage/route.ts`, `Dockerfile`, `.dockerignore`, `public/report.html`
- 수정: `lib/ledger.ts`·`lib/perps.ts`·`lib/launchpad.ts`(웹훅 호출), `.env.example`(WEBHOOK_URL)
