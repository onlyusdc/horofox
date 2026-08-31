# Add: Telegram Connector

## Why

웨지 A(소셜 트레이딩 에이전트)의 1차 배포 채널 결정: Telegram. 글로벌 크립토 커뮤니티의 실제 허브이고, 봇 API가 무료이며, 그룹 채팅에 봇 응답이 노출되는 특성상 그룹 단위 확산(바이럴)에 가장 유리. 글로벌 분배 가설과 일치. 웹 터미널은 채널 1개일 뿐이고, Bankr류 제품의 실제 성장은 채널(소셜)에서 일어난다.

## What Changes

- 기존 에이전트 코어(LLM + 툴)를 재사용하는 Telegram 봇 커넥터 추가 (롱폴링, 웹훅 불필요)
- 코어 공용화: LLM 프로바이더 생성(`lib/llm.ts`)과 시스템 프롬프트(`lib/prompt.ts`)를 웹 라우트와 봇이 공유
- 채팅방별 대화 메모리(인메모리, 최근 N턴)로 멀티턴 맥락 유지
- 그룹에서는 봇 멘션(@username)에만, 개인 채팅에서는 항상 응답

## Capabilities

### New Capabilities

- `telegram-connector`: 텔레그램 메시지 수신 → 에이전트 실행 → 응답 전송

### Modified Capabilities

(없음 — 기존 `chat-terminal`, `agent-tools` 요구사항 변화 없음, 코어 공용화는 구현 리팩터)

## Impact

- 신규: `bot/telegram.ts`, `bot/agent.ts`
- 수정: `app/api/chat/route.ts`(공용 모듈로 교체), `package.json`(dotenv 의존성, `bot` 스크립트)
- 환경변수 추가: `TELEGRAM_BOT_TOKEN` (BotFather 발급)
- 페이퍼 트레이딩 유지 — 비커스토디얼 실거래는 Phase 2 (별도 변경)
