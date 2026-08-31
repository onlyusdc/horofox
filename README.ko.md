# Agent Terminal → 제2의 Bankr 프로젝트

Bankr(bankr.bot)를 통째로 클론해 구조를 이해하고, 그 위에 **Hyperliquid + x402**를 독자 레이어로 얹는 프로젝트.

## Bankr 부품별 클론 현황

| # | Bankr의 부품 | 우리 구현 | 상태 |
|---|---|---|---|
| 1 | 웹 터미널 + 에이전트 브레인 | Next.js 채팅 UI + `lib/tools.ts` | ✅ 동작 (페이퍼) |
| 2 | 소셜 채널 — 텔레그램 | `bot/telegram.ts` 롱폴링 | ✅ 구현, 토큰 입력 대기 |
| 2b | 소셜 채널 — 디스코드 | `bot/discord.ts` | ✅ 스캐폴드, 토큰 입력 대기 |
| 2c | 트레이더 대시보드 (비채팅 UI) | `/dashboard` — REST API만으로 동작, 체결 저널 | ✅ 동작 |
| 3 | Agent REST API | `/api/v1/*` (가격·스왑·퍼펫·런치·잔액) | ✅ 동작 검증 |
| 4 | CLI | `npm run cli` (10개 커맨드) | ✅ 동작 검증 |
| 5 | 퍼펫 트레이딩 ← 독자(Hyperliquid) | `lib/perps.ts` 실시세 + 페이퍼 포지션/PnL | ✅ 실데이터 검증 |
| 6 | 토큰 런치패드 | `lib/launchpad.ts` 본딩커브 + 1% 수수료 적립 | ✅ 수학 검증 |
| 7 | LLM 게이트웨이 | `/api/gateway/v1/chat/completions` + 사용량 적산 | ✅ 인증 검증 |
| 8 | x402 유료 API ← 독자 | `/api/x402` 402 페이월 + 데모 모드 | ✅ 스펙 준수 응답 |
| 9 | 스킬 시스템 | `skills/*.ts` + 레지스트리 병합 (gas 예시) | ✅ |
| 10 | 온체인 지갑 | Base Sepolia 잔액 조회 (`EVM_PRIVATEKEY` 시 내 지갑 모드) | ✅ RPC 검증 |
| 11 | 실제 스왑/주문 서명 | Base 테스트넷 + HL SDK | ⬜ Phase 2 (키 필요) |
| 12 | 런치패드 온체인화 / 수수료→컴퓨팅비 전환 | 컨트랙트 | ⬜ 법률 검토 후 |
| 13 | X·파캐스터 채널, 웹훅, 스킬 마켓 UI | — | ⬜ 백로그 |

독자 컨셉: **"채팅으로 Hyperliquid 퍼펫을 치고, x402로 자기 API 비용을 스스로 내는 에이전트"**

## 실행

```bash
npm install
cp .env.example .env.local   # OPENAI_API_KEY 필수 + 채널 토큰 등 선택
npm run dev -- -p 3002       # 웹 (랜딩 /, 터미널 /terminal, 대시보드 /dashboard)
npm run bot                  # 텔레그램 봇
npm run bot:discord          # 디스코드 봇
npm run cli                  # CLI (price/swap/perp/launch/…)
npm run test:tools           # 기존 툴 테스트
npm run test:parity          # 패리티 통합 테스트 (HL 실시세 포함)
```

## 검증된 것 (2026-08-30)

- Hyperliquid BTC/ETH 실시간 mid 조회 → 페이퍼 롱 진입(mark 평가)→ 청산 정산 일치
- 런치패드: 발행(0.0001) → 매수 시 가격 상승 → 전량 매도 → 1% 수수료 적립 확인
- REST: `/api/v1/price` 2479.28, `/api/v1/swap` 체결, x402 데모/에러처리, gateway 401
- 온체인: Base Sepolia 주소 잔액 조회, `next build` 타입 통과

## 규제 메모 (법률 자문 대체 아님)

- 커스터디얼(플랫폼 보관) 구조는 관할별 라이선스 영역 → **비커스토디얼 퍼스트**
- 퍼펫·토큰 발행은 테스트넷/페이퍼로 먼저, 실서비스 전 해당 관할 규제 전문가 검토
