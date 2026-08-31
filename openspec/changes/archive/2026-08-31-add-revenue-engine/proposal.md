# Add: Revenue Engine

## Why

Bankr의 수익 모델(①스왑 수수료 ②런치패드 수수료 ③API 과금) 중 현재 시스템에 없는 "수수료 집계·과금·수지"를 구현한다. 특히 LLM 게이트웨이는 인증만 있고 과금이 없어 무한 무료 — 크레딧 잔액으로 토큰 과금을 하고, 런치패드 수수료 − LLM 비용 = 순수익(플라이휠 흑자/적자)을 계기판으로 보여준다. "스스로 지속하는 에이전트"의 숫자를 만드는 변경.

## What Changes

- `lib/revenue.ts`: 수익 장부(data/revenue.json) — 스왑 수수료·게이트웨이 과금 집계, 런치패드 수수료(tokens.json) 합산, LLM 비용(usage.json × 요율) 추정, 순수익 계산
- 스왑 수수료: 체결가의 0.5%(env 조정)를 플랫폼 수익으로, 결과에 fee 명시
- 게이트웨이 크레딧 과금: 키별 잔액(data/credits.json), 호출 후 토큰량 과금, 잔액 없으면 402, 데모 탑업 엔드포인트
- `GET /api/v1/revenue` + 대시보드 "수익 엔진" 카드

## Capabilities

### New Capabilities

- `revenue-engine`: 수수료 집계, 게이트웨이 크레딧 과금, 플라이휠 요약

### Modified Capabilities

(없음 — 스왑/게이트웨이 동작에 수수료·과금 레이어 추가)

## Impact

- 신규: `lib/revenue.ts`, `app/api/gateway/topup/route.ts`
- 수정: `lib/ledger.ts`(스왑 수수료), `app/api/gateway/v1/chat/completions/route.ts`(크레딧 검사·차감), REST `revenue` 케이스, 대시보드 카드, `.env.example`
