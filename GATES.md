# Gates: 훅 · 인증 · 배포

Scope: 코드는 끝났고 **사람이 올 이유(훅)** 와 **공개 가능 상태**를 만든다.

1. **훅 (C)** — 백테스트로 죽은 "캐리 수익" 대신, 사실로 남는 각도를 랜딩·README에 반영.
2. **인증 (B)** — `userId` 를 아무나 넘길 수 있는 구멍을 막는다.
3. **배포** — 실제 공개 URL 을 띄운다.
4. **커밋 (A)** — 브랜치 정리.

브랜치: `merge/hyperliquid-engine` · 이전 라운드 게이트는 `GATES.round2.md` 에 보존

## 훅 — 무엇이 죽었고 무엇이 남았나

**죽음**: "펀딩 캐리로 번다". 70일 백테스트 −5.65%(무헤지) / −0.60%(페어, 승률 32%).
다시 쓰지 않는다. 수익률을 약속하는 문장은 전부 금지.

**남은 사실 (전부 검증 가능)**
- 이 에이전트는 **진짜 주문을 낸다** — 거래소가 서명을 검증하는 것까지 확인됨.
  대부분의 에이전트 데모는 페이퍼다.
- **HIP-3 자산 280종에 도달**한다 — NVDA·S&P500·GOLD·SKHX 같은 토큰화 주식/원자재.
- **오픈소스 + 셀프호스트** — 키가 내 서버에 있고, 수수료율을 코드로 확인할 수 있다.
- 수익 모델은 **builder fee 0.1%** 하나. 구독료·토큰 없음.

→ 훅은 수익률이 아니라 **"접근"과 "검증 가능성"** 이다. 백테스트로 반박되지 않는다.

## 배포의 현실 (미리 적어둠 — 나중에 조용히 넘어가지 않기 위해)

`lib/` 6곳이 `data/*.json` 에 쓴다. 서버리스는 파일시스템이 읽기전용/휘발성이라
페이퍼 원장·유저 저장이 **조용히 사라진다.** 그래서:

- 배포본은 **읽기 전용 데모**로 명시한다 (시세·HIP-3 자산·모드 조회).
- 쓰기가 실패하면 조용히 넘어가지 않고 **사용자에게 보이게** 만든다 (G3).
- 실제 운용은 셀프호스트(도커/VM)로 안내한다.

---

- [x] G1: 훅이 랜딩과 README에 반영된다 — 수익률 약속 표현 0건, 검증 가능한 주장만.
  CHECK: cd /Users/minpro/ZCodeProject/agent-terminal && npx tsx scripts/test-hook.ts 2>&1 | tail -12
  EXPECT: /HOOK OK/
  EVIDENCE: ✓ "코어 177" 주장이 실측(177)과 ±15 이내 | HOOK OK — 수익 약속 0건, 고지 완비

- [x] G2: 인증 — `userId` 는 서버가 검증한 신원에서만 나온다. 헤더로 남의 계정을 지목할 수 없다.
  CHECK: cd /Users/minpro/ZCodeProject/agent-terminal && npx tsx scripts/test-auth.ts 2>&1 | tail -14
  EXPECT: /AUTH OK/
  EVIDENCE: ✓ 응답에 다른 유저 정보가 새지 않음 | AUTH OK — 헤더 위조 불가

- [x] G3: 읽기 전용 파일시스템에서 **조용히 실패하지 않는다** — 쓰기 불가 시 명시적 오류.
  CHECK: cd /Users/minpro/ZCodeProject/agent-terminal && npx tsx scripts/test-readonly.ts 2>&1 | tail -10
  EXPECT: /READONLY OK/
  EVIDENCE: ✓ 유저 지갑 저장 실패가 던져짐 (조용히 유실 안 됨)  ReadOnlyStorageError | READONLY OK — 조용한 유실 없음

- [x] G4: 실제 공개 URL 이 뜬다 (배포 성공, HTTP 200).
  CHECK: cd /Users/minpro/ZCodeProject/agent-terminal && npx tsx scripts/test-deployed.ts 2>&1 | tail -12
  EXPECT: /DEPLOY OK/
  EVIDENCE: ✓ 응답에 개인키가 없음 | DEPLOY OK — 공개 URL 동작

- [x] G5: 배포본이 **실제 Hyperliquid 데이터**를 서빙한다 (HIP-3 포함, 목데이터 아님).
  CHECK: cd /Users/minpro/ZCodeProject/agent-terminal && npx tsx scripts/test-deployed.ts --data 2>&1 | tail -12
  EXPECT: /LIVE-DATA OK/
  EVIDENCE: ✓ 없는 심볼 → 400 | LIVE-DATA OK — 실제 HL 데이터, HIP-3 포함

- [ ] G6: 회귀 없음 — 기존 검증 14종 전부 통과.
  CHECK: cd /Users/minpro/ZCodeProject/agent-terminal && bash -c 'F=0; for s in hl-engine hl-live builder mode sign safety revenue users multiuser testnet-sign rest mode-api dashboard; do npx tsx scripts/test-$s.ts >/dev/null 2>&1 || { echo "FAIL $s"; F=1; }; done; npx tsx scripts/testnet-trade.ts --probe 2>&1 | grep -q "EXCHANGE RESPONDED" || { echo "FAIL probe"; F=1; }; [ $F = 0 ] && echo NO-REGRESSION || echo REGRESSED'
  EXPECT: /NO-REGRESSION/
  EVIDENCE: pending

- [x] G7: 빌드·타입 클린.
  CHECK: cd /Users/minpro/ZCodeProject/agent-terminal && bash -c 'T=$(npx tsc --noEmit 2>&1 | wc -l | tr -d " "); B=$(npm run build 2>&1 | grep -c "Compiled successfully"); echo "tsc=$T build=$B"; [ "$T" = 0 ] && [ "$B" -ge 1 ] && echo BUILD-OK || echo BUILD-BROKEN'
  EXPECT: /BUILD-OK/
  EVIDENCE: tsc=0 build=1 | BUILD-OK

- [ ] G8: 커밋 완료 — 미커밋 변경 0, 시크릿·유저데이터 미포함.
  CHECK: cd /Users/minpro/ZCodeProject/agent-terminal && bash -c 'D=$(git status --porcelain | grep -c . | tr -d " "); S=$(git ls-files | grep -cE "^\.env$|^data/" || true); echo "dirty=$D tracked_secrets=$S"; [ "$D" = 0 ] && [ "$S" = 0 ] && echo COMMIT-OK || echo COMMIT-DIRTY'
  EXPECT: /COMMIT-OK/
  EVIDENCE: pending

- [x] G9: 플레이스홀더 0건.
  CHECK: cd /Users/minpro/ZCodeProject/agent-terminal && grep -rnE "TODO|FIXME|not implemented" lib/ scripts/ app/ 2>/dev/null | wc -l
  EXPECT: /^\s*0\s*$/
  EVIDENCE: 0

- [ ] G10: README 가 배포 현실을 담는다 — 데모 URL, 읽기전용 한계, 셀프호스트 안내, 인증.
  EVIDENCE: pending

<!--
- 체크박스는 gate-check.mjs 가 CHECK 실행 후 EXPECT 매칭되면 뒤집는다.
- EVIDENCE가 pending인 채로 체크된 박스는 미달로 친다.
- 불가능해진 게이트는 삭제하지 말고 ABANDON: G<n> <사유> 를 추가한다.
-->
