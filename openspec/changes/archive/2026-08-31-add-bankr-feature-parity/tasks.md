# Tasks: add-bankr-feature-parity

## 1. 기반

- [x] 1.1 의존성 설치 (viem, discord.js) + x402 패키지 확인
- [x] 1.2 `lib/perps.ts`: HL 시세 + 페이퍼 포지션/PnL
- [x] 1.3 `lib/launchpad.ts`: 본딩커브 발행/매매/수수료
- [x] 1.4 `lib/wallet.ts`: Base Sepolia 잔액 조회
- [x] 1.5 `skills/`: 스킬 로더 + gas 예시 스킬
- [x] 1.6 `lib/tools.ts` 레지스트리에 퍼펫/런치패드/지갑/스킬 통합

## 2. 배포 채널/인터페이스

- [x] 2.1 `/api/v1/*` REST 라우트 (인증 게이트)
- [x] 2.2 CLI (`npm run cli`)
- [x] 2.3 `/api/x402` 402 페이월 + 데모 모드
- [x] 2.4 `/api/gateway/v1/chat/completions` 프록시 + usage 기록
- [x] 2.5 `bot/discord.ts` 스캐폴드

## 3. 검증

- [x] 3.1 `scripts/test-parity.ts`: 퍼펫(실시세+PnL), 런치패드 수학, 스킬 로드, 지갑 조회
- [x] 3.2 REST/CLI/x402/gateway curl 검증
- [x] 3.3 `npm run build` 통과

## 4. 마케팅

- [x] 4.1 `marketing/PLAN.md` (훅·분배 가설·시장 테스트·런치 체크리스트)
