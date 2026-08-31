# Design: Bankr Feature Parity

## Context

에이전트 코어·웹 터미널·텔레그램은 동작 중. Bankr의 나머지 부품을 전부 "기본 동작" 수준으로 추가한다. 네트워크·키 없이 검증 가능한 것(수학·로직)은 지금 검증하고, 키가 필요한 것(봇·실서명·LLM)은 가이드 출력 상태까지 만든다.

## Goals / Non-Goals

**Goals**
- 모든 부품이 하나의 코어(lib/tools·llm·prompt)를 공유
- 키 없이 동작하는 부분은 즉시 검증(HL 시세, 런치패드 수학, REST, CLI, x402 402 응답)
- 실거래·실서명은 env 게이트 후 동일 인터페이스로 교체 가능

**Non-Goals**
- 실제 컨트랙트 배포/온체인 스왑(Phase 2 별도 변경), 웹훅, 브라우저 자동화, 스킬 마켓 UI, 멀티유저 인증

## Decisions

1. **Hyperliquid: 공개 info API만 사용(allMids)** + 포지션은 페이퍼(`data/perps.json`). 주문 서명은 Phase 2에서 SDK로 교체. 기본 mainnet 시세(읽기 전용), `HL_NETWORK=testnet` 전환 가능.
2. **런치패드: 가상 본딩커브(x·y=k, 초기 준비금 토큰 1,000,000 / USDC 100)** — 수학이 단순하고 pump.fun류와 같은 성질. 1% 수수료는 토큰별 적립해 플라이휠(수수료→컴퓨팅비) 시연.
3. **REST/CLI: LLM 우회** — 툴 로직(lib/*)을 직접 호출. 자연어는 채널(웹/텔레그램/디스코드)의 역할로 분리. 이게 Bankr의 "API vs 채널" 분리와 동일.
4. **x402: 402 페이월 핸드셰이크 수동 구현**(exact/base-sepolia 요구 페이로드). `X402_PAY_TO` 미설정 시 데모 모드로 무료 실행. 공식 facilitator 검증은 주소 설정 후 `x402` 패키지로 교체 지점을 명시.
5. **LLM 게이트웨이: 단일 라우트 프록시**(`Authorization: Bearer <GATEWAY_API_KEYS>`), usage를 `data/usage.json`에 적산. 스트리밍 미지원(기본 수준).
6. **스킬: `skills/*.ts` + `skills/index.ts` 정적 import** — Next 번들러 호환(동적 fs 로딩 금지). 설치 = 파일 추가 + 한 줄 import.
7. **Discord: discord.js 스캐폴드**, 토큰 없으면 안내 후 종료(텔레그램과 동일 패턴).

## Risks / Trade-offs

- [HL mainnet 시세 API 지연/차단] → 타임아웃·에러 전파, testnet 전환 옵션
- [페이퍼 퍼펫에 청산/펀딩피 없음] → 결과에 "paper" 명시, PnL은 실시간 mark로 계산
- [x402 실결제 미검증(주소/테스트 USDC 필요)] → 402 페이로드 스펙 준수 + 데모 모드 명시
- [discord.js 무거움] → 채널 커넥터는 실사용 목적이라 수용

## Open Questions

- x402 facilitator 검증의 실결제 E2E(테스트 USDC 소유 후)
