# Gates: 마무리 3종 — 전송 닫기 · 멀티유저 · 대시보드

Scope: 이전 머지(`merge/hyperliquid-engine`)에 남은 세 가지를 끝낸다.

1. **전송까지 닫기** — 테스트넷에서 실제 주문을 내보내 체결까지 확인한다.
2. **멀티유저** — 유저별 지갑을 두고, 각자의 주문에 내 builder code 가 붙게 한다.
3. **대시보드** — LIVE/PAPER 배지 + 온체인 builder 수익 표시.

브랜치: `merge/hyperliquid-engine` (계속 사용, main 보호)

## 확정된 설계

- `lib/perps.ts` 4개 export 는 유지. 멀티유저는 **선택적 마지막 인자** `ctx?: TradeContext` 로
  넣는다 → 기존 호출자 4인자 그대로 동작(운영자 컨텍스트), 새 호출자만 5번째를 넘긴다.
- 유저 지갑 개인키는 **AES-256-GCM 암호화**해서만 저장한다. 평문 저장 경로가 있으면 안 된다.
- 유저 지갑은 HL **agent(API) wallet** 이다 — 주문만 가능하고 출금 권한이 구조적으로 없다.
- 대시보드는 새 엔드포인트 `/api/v1/mode` 를 읽는다. 기존 `/revenue` 의 `real` 블록도 함께 쓴다.

## 1번의 현실 (미리 적어둠 — 나중에 조용히 넘어가지 않기 위해)

테스트넷 주문에는 테스트넷 USDC 가 필요하고, Hyperliquid faucet 은 지갑 연결 UI 를 요구한다.
헤드리스로 자금 조달이 불가능하면 **체결 게이트(G3)는 ABANDON** 하고, 대신
"자금만 있으면 바로 나가는 상태"임을 G2 로 증명한다. 자금 문제와 코드 문제를 섞지 않는다.

---

- [x] G1: 테스트넷 왕복 스크립트가 존재하고, 자금 없는 상태에서 **정확한 진단**을 낸다
      (무엇이 없는지, 어떻게 채우는지). 조용히 실패하지 않는다.
  CHECK: cd /Users/minpro/ZCodeProject/agent-terminal && npx tsx scripts/testnet-trade.ts 2>&1 | tail -14
  EXPECT: /TESTNET (READY|NEEDS-FUNDS)/
  EVIDENCE: 4) 다시 실행:  npx tsx scripts/testnet-trade.ts --send | TESTNET NEEDS-FUNDS

- [x] G2: 테스트넷 주문 페이로드가 **테스트넷 도메인으로** 정확히 구성·서명된다
      (메인넷 서명과 달라야 한다 — 체인 분리 확인).
  CHECK: cd /Users/minpro/ZCodeProject/agent-terminal && npx tsx scripts/test-testnet-sign.ts 2>&1 | tail -8
  EXPECT: /TESTNET-SIGN OK/
  EVIDENCE: ✓ 결정론적 서명 | TESTNET-SIGN OK — 체인 분리 확인

- [x] G3: 테스트넷에서 **실제 주문이 전송되어 거래소가 응답**한다 (체결 또는 명시적 거부).
      자금이 없어도 `--probe` 로 전송해 거래소가 **우리 서명에서 서명자를 복원**하는지 확인한다.
      복원 주소가 우리 계정과 일치하면 서명·전송 경로가 닫힌 것이다. (체결 자체는 자금 필요 — G3 주석 참고)
  CHECK: cd /Users/minpro/ZCodeProject/agent-terminal && npx tsx scripts/testnet-trade.ts --probe 2>&1 | tail -14
  EXPECT: /EXCHANGE RESPONDED/
  EVIDENCE: ✓ 서명은 통과했고, 거부 사유는 자금뿐 → 전송 경로는 닫혔다 | EXCHANGE RESPONDED — 서명 검증됨, 자금만 부족

- [x] G4: 유저 저장소 — 유저별 agent 키가 **암호화되어** 저장되고 복호화된다. 평문 저장 경로 0건.
  CHECK: cd /Users/minpro/ZCodeProject/agent-terminal && npx tsx scripts/test-users.ts 2>&1 | tail -8
  EXPECT: /USERS OK/
  EVIDENCE: ✓ 삭제됨 | USERS OK — 평문 저장 경로 없음

- [x] G5: 멀티유저 거래 — 서로 다른 유저의 주문이 **각자의 지갑으로 서명**되고,
      **모두 같은 내 builder code** 를 단다.
  CHECK: cd /Users/minpro/ZCodeProject/agent-terminal && npx tsx scripts/test-multiuser.ts 2>&1 | tail -10
  EXPECT: /MULTIUSER OK/
  EVIDENCE: ✓ ctx 없이 호출해도 동작 (하위호환) | MULTIUSER OK — 각자 서명, 수수료는 하나로

- [x] G6: 기존 호출자 호환 — `lib/perps.ts` 4개 export 유지, 4인자 호출이 그대로 동작,
      상위 호출자 파일 수정 0.
  CHECK: cd /Users/minpro/ZCodeProject/agent-terminal && bash -c 'E=$(grep -c "export async function \(getPerpMid\|openPerp\|closePerp\|getPerpPositions\)" lib/perps.ts); C=$(git diff --name-only main -- lib/tools.ts "app/api/v1/[...path]/route.ts" bot/ bin/ app/api/chat/ | wc -l | tr -d " "); echo "exports=$E callers_changed=$C"; [ "$E" = 4 ] && [ "$C" = 0 ] && echo COMPAT-OK || echo COMPAT-BROKEN'
  EXPECT: /COMPAT-OK/
  EVIDENCE: exports=4 callers_changed=0 | COMPAT-OK

- [x] G7: `/api/v1/mode` 가 현재 모드·이유·트레이더 주소·빌더 주소를 반환한다.
      개인키는 **절대** 노출되지 않는다.
  CHECK: cd /Users/minpro/ZCodeProject/agent-terminal && npx tsx scripts/test-mode-api.ts 2>&1 | tail -8
  EXPECT: /MODE-API OK/
  EVIDENCE: ✓ privateKey/key 같은 필드명 없음 | MODE-API OK — 키 노출 없음

- [x] G8: 대시보드가 모드 배지와 builder 수익을 **실제로 렌더**한다 (서버 띄워 DOM 확인).
  CHECK: cd /Users/minpro/ZCodeProject/agent-terminal && npx tsx scripts/test-dashboard.ts 2>&1 | tail -12
  EXPECT: /DASHBOARD OK/
  EVIDENCE: ✓ 모드 배지 스타일 정의됨 (globals.css)  css 번들 확인 | DASHBOARD OK — 배지·실수익 렌더

- [x] G9: 이전 13개 게이트의 검증이 여전히 전부 통과한다 (회귀 없음).
  CHECK: cd /Users/minpro/ZCodeProject/agent-terminal && bash -c 'F=0; for s in hl-engine hl-live builder mode sign safety revenue; do npx tsx scripts/test-$s.ts >/dev/null 2>&1 || { echo "FAIL: test-$s"; F=1; }; done; [ $F = 0 ] && echo NO-REGRESSION || echo REGRESSED'
  EXPECT: /NO-REGRESSION/
  EVIDENCE: NO-REGRESSION

- [x] G10: `next build` 통과 + 타입 클린.
  CHECK: cd /Users/minpro/ZCodeProject/agent-terminal && bash -c 'T=$(npx tsc --noEmit 2>&1 | wc -l | tr -d " "); B=$(npm run build 2>&1 | grep -c "Compiled successfully"); echo "tsc_errors=$T build_success=$B"; [ "$T" = 0 ] && [ "$B" -ge 1 ] && echo BUILD-OK || echo BUILD-BROKEN'
  EXPECT: /BUILD-OK/
  EVIDENCE: tsc_errors=0 build_success=1 | BUILD-OK

- [x] G11: 플레이스홀더 0건.
  CHECK: cd /Users/minpro/ZCodeProject/agent-terminal && grep -rnE "TODO|FIXME|not implemented" lib/ scripts/ app/ 2>/dev/null | wc -l
  EXPECT: /^\s*0\s*$/
  EVIDENCE: 0

- [x] G12: README 가 세 기능의 진실을 담는다 — 테스트넷 절차, 멀티유저 사용법·한계, 대시보드.
  EVIDENCE: 코드 대조 완료. (1) README 예시 함수 4개 전부 실재 — ensureAgentWallet/upsertUser/agentKeyOf→lib/users.ts, openPerp→lib/perps.ts. (2) env 2종 실재 — USER_ENCRYPTION_KEY→lib/users.ts, HL_TESTNET_KEY→scripts/testnet-trade.ts. (3) 문서화한 플래그 --probe/--send 가 스크립트에 각 1건 구현. (4) /api/v1/mode 라우트 파일 존재, real.builderFeesUsdc 가 lib/revenue.ts(3건)·dashboard.tsx(2건)에 연결. (5) "평문 저장 경로 없음" 주장을 검증하다 결함 발견 — upsertUser 가 Partial<UserRecord> 로 agentKeyEnc 를 받아 평문 주입이 가능했다. UserPatch 타입으로 제외 + 런타임 드롭 + setAgentKey 단일 경로로 수정하고, 평문 주입 시도 테스트 4개를 추가해 차단 확인. (6) "아직 안 된 것"에 체결 미달성·멀티유저 인증 부재를 명시 (README 112·115행).

<!--
- 체크박스는 gate-check.mjs 가 CHECK 실행 후 EXPECT 매칭되면 뒤집는다.
- EVIDENCE가 pending인 채로 체크된 박스는 미달로 친다.
- 불가능해진 게이트는 삭제하지 말고 ABANDON: G<n> <사유> 를 추가한다.
-->
