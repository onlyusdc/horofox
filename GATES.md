# Gates: Bankr 4부품 + 한/영 다국어 + 심플화

Scope: Bankr 의 네 부품을 **그대로 하되 더 심플·빠르게**, 그리고 한국어/영어 둘 다.

1. **x402 유료 API** — 지금 CoinGecko 403 으로 죽어 있다. HL 데이터로 갈아끼워 살린다.
2. **토큰 런치패드** — 페이퍼 본딩커브(145줄)가 이미 있다. UI 를 단순화하고 다국어를 붙인다.
3. **구독** — 지금 0줄. x402 로 USDC 를 받아 사용량을 푸는 방식으로 만든다 (외부 결제사 불필요).
4. **소셜 봇** — 텔레그램·디스코드 코드는 있다. 토큰만 넣으면 도는지 검증하고 문서화한다.
5. **다국어** — UI 한국어 하드코딩 **732개**를 한/영 사전으로 뺀다.
6. **심플화** — 랜딩이 면책으로 시작해 "뭔지 모르겠다"는 상태다. 살아있는 숫자를 앞으로.

브랜치: `merge/hyperliquid-engine` · 이전 라운드 게이트는 `GATES.round2/3.md`

## 확정된 설계

- **i18n 은 의존성 없이** 직접 만든다. 사전 + `useLang()` + `localStorage`.
  next-intl 같은 걸 넣으면 라우팅 구조가 바뀌어 "심플"에서 멀어진다.
- **구독은 x402 로 받는다.** 이미 `x402` 패키지가 있고 402 페이월 코드가 돈다.
  Stripe·Privy 같은 외부 계정이 필요 없어 지금 만들 수 있다.
- **런치패드는 페이퍼 유지.** 온체인화는 컨트랙트·가스·감사가 필요해 이번 범위 밖이다.
  대신 그 사실을 UI 에 명시한다 (지금은 안 써 있어서 진짜처럼 보인다).
- 수익 약속 표현은 계속 금지 (지난 라운드 원칙 유지).

## 막히면 정직하게

외부 계정·자금이 필요해 못 하는 게 나오면 **ABANDON 으로 남긴다.**
특히 봇 토큰(@BotFather)과 x402 수취 주소는 형이 넣어야 하는 값이다 —
그건 "코드가 안 됨"이 아니라 "설정이 없음"이므로 구분해서 적는다.

---

- [x] G1: i18n 기반 — 한/영 전환이 실제로 동작하고, 사전에 누락된 키가 0개다.
  CHECK: cd /Users/minpro/ZCodeProject/agent-terminal && npx tsx scripts/test-i18n.ts 2>&1 | tail -12
  EXPECT: /I18N OK/
  EVIDENCE: ✓ 라벨 정의됨 | I18N OK — 사전 완전

- [x] G2: 랜딩·터미널·대시보드에 한국어 하드코딩이 남지 않는다 (사전 경유).
  CHECK: cd /Users/minpro/ZCodeProject/agent-terminal && npx tsx scripts/test-i18n.ts --coverage 2>&1 | tail -10
  EXPECT: /COVERAGE OK/
  EVIDENCE: ✓ LangProvider 가 layout 에 있다 | COVERAGE OK — UI 하드코딩 없음

- [x] G3: x402 유료 API 가 살아난다 — HL 데이터 기반, 402 페이월 규격 준수, 툴 3개 이상.
  CHECK: cd /Users/minpro/ZCodeProject/agent-terminal && npx tsx scripts/test-x402.ts 2>&1 | tail -14
  EXPECT: /X402 OK/
  EVIDENCE: ✓ 스킴·네트워크 명시 | X402 OK — 유료 API 동작

- [x] G4: 구독 — x402 USDC 결제로 사용량이 풀린다. 무료 한도·초과 차단·해제가 동작한다.
  CHECK: cd /Users/minpro/ZCodeProject/agent-terminal && npx tsx scripts/test-subscription.ts 2>&1 | tail -14
  EXPECT: /SUBSCRIPTION OK/
  EVIDENCE: ✓ degraded 로 표시해 숨기지 않음 | SUBSCRIPTION OK — 한도·결제·이월 동작

- [x] G5: 런치패드가 페이퍼임을 UI 가 명시한다 + 다국어 적용.
  CHECK: cd /Users/minpro/ZCodeProject/agent-terminal && npx tsx scripts/test-launchpad-ui.ts 2>&1 | tail -10
  EXPECT: /LAUNCHPAD-UI OK/
  EVIDENCE: ✓ launchToken 설명에 paper 명시 | LAUNCHPAD-UI OK — 페이퍼임이 명시됨

- [x] G6: 소셜 봇 — 토큰 없이도 기동 경로가 검증되고, 없으면 명확히 안내한다.
  CHECK: cd /Users/minpro/ZCodeProject/agent-terminal && npx tsx scripts/test-bots.ts 2>&1 | tail -12
  EXPECT: /BOTS OK/
  EVIDENCE: ✓ README 에 토큰 발급처 안내 | BOTS OK — 설정 부재를 코드 결함과 구분

- [x] G7: 랜딩 심플화 — 첫 화면에 **살아있는 숫자**가 나오고, 면책은 아래로 내려간다.
  CHECK: cd /Users/minpro/ZCodeProject/agent-terminal && npx tsx scripts/test-landing.ts 2>&1 | tail -12
  EXPECT: /LANDING OK/
  EVIDENCE: ✓ 기능 카드가 데이터로 분리됨 | LANDING OK — 증거 먼저, 면책은 유지

- [ ] G8: 회귀 없음 — 기존 검증 22종 전부 통과.
  CHECK: cd /Users/minpro/ZCodeProject/agent-terminal && bash -c 'F=0; for f in scripts/test-*.ts; do case "$f" in *deployed*|*posture*|*nosecrets*) continue;; esac; npx tsx "$f" >/dev/null 2>&1 || { echo "FAIL $f"; F=1; }; done; [ $F = 0 ] && echo NO-REGRESSION || echo REGRESSED'
  EXPECT: /NO-REGRESSION/
  EVIDENCE: pending

- [x] G9: 빌드·타입 클린.
  CHECK: cd /Users/minpro/ZCodeProject/agent-terminal && bash -c 'T=$(npx tsc --noEmit 2>&1 | wc -l | tr -d " "); B=$(npm run build 2>&1 | grep -c "Compiled successfully"); echo "tsc=$T build=$B"; [ "$T" = 0 ] && [ "$B" -ge 1 ] && echo BUILD-OK || echo BUILD-BROKEN'
  EXPECT: /BUILD-OK/
  EVIDENCE: tsc=0 build=1 | BUILD-OK

- [x] G10: 배포 + 시크릿 유출 0 + 배포본에서 한/영이 실제로 동작.
  CHECK: cd /Users/minpro/ZCodeProject/agent-terminal && npx tsx scripts/test-nosecrets.ts 2>&1 | tail -3 && npx tsx scripts/test-deployed.ts 2>&1 | tail -6
  EXPECT: /DEPLOY OK/
  EVIDENCE: ✓ 응답에 개인키가 없음 | DEPLOY OK — 공개 URL 동작

- [x] G11: 플레이스홀더 0건 + 커밋 완료.
  CHECK: cd /Users/minpro/ZCodeProject/agent-terminal && bash -c 'P=$(grep -rnE "TODO|FIXME|not implemented" lib/ scripts/ app/ 2>/dev/null | wc -l | tr -d " "); D=$(git status --porcelain | grep -c . | tr -d " "); echo "placeholders=$P dirty=$D"; [ "$P" = 0 ] && [ "$D" = 0 ] && echo CLEAN || echo DIRTY'
  EXPECT: /CLEAN/
  EVIDENCE: placeholders=0 dirty=0 | CLEAN

- [x] G12: README 가 4부품·다국어·설정 필요값을 정직하게 담는다.
  EVIDENCE: 실물 대조 완료. (1) 문서화한 엔드포인트 3개 전부 존재 — /api/v1/quota, /api/x402, /api/v1/mode. (2) env 3종이 코드에 실재 — FREE_CALLS_PER_DAY·CALLS_PER_PAYMENT→lib/quota.ts, X402_PAY_TO→x402+quota 라우트. (3) x402 툴 4종(price/markets/funding/portfolio) 구현 확인. (4) 문서 표시가 $0.001 이 코드 `PRICE_USDC = 0.001` 과 일치 (불일치 시 test-x402 가 실패). (5) 배포본 실호출: funding SKHX 96.8% "longs pay shorts", quota 무료 20회·잔여 20·degraded=false. (6) 봇 토큰 발급처(@BotFather / discord.com/developers, Message Content Intent 주의)와 CoinGecko 403·429 교체 사유를 명시.

<!--
- 체크박스는 gate-check.mjs 가 CHECK 실행 후 EXPECT 매칭되면 뒤집는다.
- EVIDENCE가 pending인 채로 체크된 박스는 미달로 친다.
- 불가능해진 게이트는 삭제하지 말고 ABANDON: G<n> <사유> 를 추가한다.
-->
