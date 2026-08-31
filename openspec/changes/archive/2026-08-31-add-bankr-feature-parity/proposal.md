# Add: Bankr Feature Parity

## Why

최종 목표는 Bankr의 모든 기능을 "기본 동작" 수준으로 갖춘 클론이다(이해도 극대화). 그 위에 독자 레이어로 Hyperliquid(채팅 퍼펫)와 x402(유료 API/자기결제 에이전트)를 얹는다. 키가 필요한 것은 환경변수만 넣으면 켜지는 상태까지 구현한다.

## What Changes

- Agent REST API(`/api/v1/*`)와 CLI — LLM 없이 툴을 직접 호출
- Hyperliquid 퍼펫: 실시간 시세(공개 info API) + 페이퍼 포지션(PnL 계산)
- 토큰 런치패드(페이퍼): 가상 본딩커브 발행/매매 + 1% 수수료 적립(플라이휠 시연)
- 온체인 지갑: Base Sepolia 잔액 조회(viem), `EVM_PRIVATEKEY` 있으면 내 지갑 모드
- x402 유료 엔드포인트: 402 페이월 핸드셰이크, 결제/demо 모드
- LLM 게이트웨이: OpenAI 호환 프록시 + API 키 인증 + 사용량 기록
- 스킬 시스템: 파일 하나 추가로 툴 확장 + 예시 스킬(Base 가스비)
- Discord 커넥터 스캐폴드(토큰 게이트)

## Capabilities

### New Capabilities

- `agent-api`: REST API + CLI로 툴 직접 호출
- `hyperliquid-perps`: 실시간 시세 + 페이퍼 퍼펫 포지션/PnL
- `token-launchpad`: 페이퍼 본딩커브 발행·매매·수수료 적립
- `onchain-wallet`: Base Sepolia 잔액 조회, 키 있으면 내 지갑
- `x402-endpoint`: 유료 툴 엔드포인트 402 페이월
- `llm-gateway`: OpenAI 호환 프록시 + 사용량 기록
- `skills`: 스킬 파일 기반 툴 확장
- `discord-connector`: 디스코드 채널 스캐폴드

### Modified Capabilities

(없음 — 기존 spec 요구사항 변화 없음)

## Impact

- 신규: `lib/perps.ts`, `lib/launchpad.ts`, `lib/wallet.ts`, `skills/`, `app/api/v1/`, `app/api/gateway/`, `app/api/x402/`, `bin/cli.ts`, `bot/discord.ts`, `scripts/test-parity.ts`, `marketing/PLAN.md`
- 수정: `lib/tools.ts`(레지스트리 확장), `package.json`(의존성·스크립트), `.env.example`
- 의존성: viem, discord.js, x402(가능 시)
- 키 게이트: `TELEGRAM_BOT_TOKEN`, `DISCORD_BOT_TOKEN`, `EVM_PRIVATEKEY`, `GATEWAY_API_KEYS`, `X402_PAY_TO`
