# Gates: Bankr 전략 추종 + 우리 엣지

Scope: Bankr 의 구조를 따라가되, 걔들이 **비워둔 자리**를 우리 수익원으로 만든다.

## 조사에서 확정된 것 (근거)

`research/` 전수 조사 결과:

- Bankr 플라이휠 = **토큰 발행 → 그 거래 수수료 → 에이전트 추론비**
- 그런데 스왑 수수료 **0.7% 중 95% 가 창작자 몫** → Bankr 본인 몫은 1/19.
  즉 **런치패드는 유인책이지 주 수입원이 아니다.**
- 그 발행 매출은 **피크 대비 −92%** 로 무너진 전례가 있다 (DefiLlama 월별).
- `hyperliquid.md` 192줄 전문에 **builder fee 수취 맥락 0건** —
  걔들은 HL 거래를 중개하면서 그 수수료를 안 걷는다.
- 걔들 "Stocks" 는 주식 이름 밈코인. **진짜 토큰화 주식은 HIP-3 쪽**이고 우리는 280종에 도달한다.

## 우리 엣지 (한 문장)

> **같은 플라이휠을 "발행" 대신 "거래"로 돌린다.**
> 에이전트가 토큰을 찍어 자금을 조달하는 대신, **거래 흐름의 0.1% 로 자기 추론비를 낸다.**
> 프로토콜이 지급하므로 면제 압력이 없고, 밈코인 사이클에 묶이지 않는다.

## 지금 상태 (실측)

배관 3개가 있는데 **연결이 안 돼 있다**:
- `lib/hl/core.ts` builderField — 주문에 수수료 부착 (3곳)
- `lib/hl/revenue.ts` builderRevenue — 온체인 수취액 조회 (1곳)
- `lib/quota.ts` grantCredits — LLM 사용량 크레딧 부여 (1곳)

이걸 잇는 게 이번 라운드의 핵심이다.

## 명시적 비범위

- **토큰 발행 온체인화**는 안 한다 (컨트랙트·감사 필요). 페이퍼 유지 + 그 사실 명시는 이미 됨.
- **Leaderboard·Projects 쇼케이스**는 안 만든다. 유저가 0명인데 만들면 빈 껍데기 극장이다.
  Bankr 는 실적이 있어서 그게 작동한다. 우리는 아직 아니다.

---

- [x] G1: 자가자금 루프 — 온체인 builder 수수료가 LLM 크레딧으로 **자동 전환**된다.
      이미 정산한 수수료를 두 번 세지 않는다(멱등).
  CHECK: cd /Users/minpro/ZCodeProject/agent-terminal && npx tsx scripts/test-selffund.ts 2>&1 | tail -14
  EXPECT: /SELFFUND OK/
  EVIDENCE: SELFFUND OK — 이중 지급 없음 (25 assertions). 순차 1차 5,000회 → 2차 granted=0. 동시 2회 호출 합계도 5,000회(직렬화 전에는 10,000). 누적 17,500 = 5,000+5,000+7,500.

- [x] G2: `/api/v1/selffund` 가 현재 루프 상태를 반환한다 (수취액·전환분·잔여 크레딧).
  CHECK: cd /Users/minpro/ZCodeProject/agent-terminal && npx tsx scripts/test-selffund.ts --api 2>&1 | tail -12
  EXPECT: /SELFFUND-API OK/
  EVIDENCE: SELFFUND-API OK (15 assertions, 재측정). 무토큰 GET 401 / 유저 POST 403 / 운영자 POST 200. 응답에 키·시크릿 0.

- [x] G3: 공개 Metrics — Bankr 처럼 지표를 공개하되 **실수익과 페이퍼를 절대 합산하지 않는다**.
  CHECK: cd /Users/minpro/ZCodeProject/agent-terminal && npx tsx scripts/test-public-metrics.ts 2>&1 | tail -14
  EXPECT: /METRICS OK/
  EVIDENCE: METRICS OK (16 assertions) — live·paper 필드명 공유 0개, 합계 필드 없음, live+paper 와 같은 값 노출 0. /api/v1/metrics 200, /metrics 13,201 bytes.

- [x] G4: HIP-3 우위가 수치로 노출된다 — 우리가 닿는 자산 수와, 그중 토큰화 주식/원자재 분류.
  CHECK: cd /Users/minpro/ZCodeProject/agent-terminal && npx tsx scripts/test-coverage.ts 2>&1 | tail -14
  EXPECT: /COVERAGE OK/
  EVIDENCE: COVERAGE OK (16 assertions) — 280 = 크립토 177 + HIP-3 103 (주식 93 / 지수·원자재 10). 표본 TSLA NVDA HOOD INTC PLTR COIN META. LiveTicker 하드코딩 `177 +` 제거.

- [x] G5: 한/영 사전에 신규 문구가 전부 들어간다 (누락·복붙 0).
  CHECK: cd /Users/minpro/ZCodeProject/agent-terminal && npx tsx scripts/test-i18n.ts 2>&1 | tail -6
  EXPECT: /I18N OK/
  EVIDENCE: I18N OK — 사전 77키 × 2언어, 누락·빈값·복붙 0. COVERAGE OK — app/metrics/page.tsx 포함 4개 UI 파일 한국어 하드코딩 0건.

- [x] G6: 회귀 없음 — 기존 검증 전부 통과.
  CHECK: cd /Users/minpro/ZCodeProject/agent-terminal && bash -c 'F=0; for f in scripts/test-*.ts; do case "$f" in *deployed*|*posture*|*nosecrets*) continue;; esac; npx tsx "$f" >/dev/null 2>&1 || { echo "FAIL $f"; F=1; }; done; [ $F = 0 ] && echo NO-REGRESSION || echo REGRESSED'
  EXPECT: /NO-REGRESSION/
  EVIDENCE: NO-REGRESSION — ran=28, 전부 통과 (deployed/posture/nosecrets 제외). 경합 수정 후 재실행 포함.

- [x] G7: 빌드·타입 클린 + 시크릿 유출 0.
  CHECK: cd /Users/minpro/ZCodeProject/agent-terminal && bash -c 'T=$(npx tsc --noEmit 2>&1 | wc -l | tr -d " "); B=$(npm run build 2>&1 | grep -c "Compiled successfully"); S=$(npx tsx scripts/test-nosecrets.ts 2>&1 | grep -c "NOSECRETS OK"); echo "tsc=$T build=$B secrets_ok=$S"; [ "$T" = 0 ] && [ "$B" -ge 1 ] && [ "$S" = 1 ] && echo BUILD-OK || echo BUILD-BROKEN'
  EXPECT: /BUILD-OK/
  EVIDENCE: tsc=0 build=1 secrets_ok=1 → BUILD-OK (경합 수정 후 재측정). /api/v1/metrics 148 B, /metrics 6.14 kB 라우트 생성됨.

- [ ] G8: 배포 + 배포본에서 새 기능이 실제로 동작.
  CHECK: cd /Users/minpro/ZCodeProject/agent-terminal && npx tsx scripts/test-deployed.ts --data 2>&1 | tail -8
  EXPECT: /LIVE-DATA OK/
  EVIDENCE: pending

- [x] G9: 플레이스홀더 0 + 커밋 완료.
  CHECK: cd /Users/minpro/ZCodeProject/agent-terminal && bash -c 'P=$(grep -rnE "TODO|FIXME|not implemented" lib/ scripts/ app/ 2>/dev/null | wc -l | tr -d " "); D=$(git status --porcelain | grep -c . | tr -d " "); echo "placeholders=$P dirty=$D"; [ "$P" = 0 ] && [ "$D" = 0 ] && echo CLEAN || echo DIRTY'
  EXPECT: /CLEAN/
  EVIDENCE: placeholders=0 · 커밋 530e103 (merge/hyperliquid-engine), 워킹트리 정리됨.

- [x] G10: README 가 엣지와 그 근거를 담는다 — 왜 발행이 아니라 거래인지, Bankr 와 뭐가 다른지.
  EVIDENCE: README 에 'The edge' 섹션 추가 — 0.7%/95% 근거, −92% 근거, 배관 3파일 표, 멱등성 검증 명령, 280종 실측, live·paper 미합산 근거. Bankr 문서 재측정: 192줄 중 'builder' 1회, 그마저 'HIP-3 builder-deployed dexes'(수수료 수취 아님).

<!--
- 체크박스는 gate-check.mjs 가 CHECK 실행 후 EXPECT 매칭되면 뒤집는다.
- EVIDENCE가 pending인 채로 체크된 박스는 미달로 친다.
- 불가능해진 게이트는 삭제하지 말고 ABANDON: G<n> <사유> 를 추가한다.
-->

ABANDON: G8 배포는 사용자 승인이 필요해 이번 라운드에서 실행하지 못함. 코드·빌드·시크릿 검사(G7)까지는 통과했고, 배포 명령만 남아 있다. 승인 시 `bash scripts/deploy-cf.sh` → `npx tsx scripts/test-deployed.ts --data` 로 닫는다.
