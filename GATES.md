# Gates: HL 뉴스 대응 — 경쟁자·근거·HIP-4

Scope: 2026-07~08 Hyperliquid 발표에서 나온 세 가지를 처리한다.

1. **경쟁자 조사** — Talis(AI 트레이딩 앱, iOS), StableJack. 우리와 같은 자리다.
2. **근거 보강** — VALR(첫 CEX)·Base app·Oku 가 builder codes 로 붙었다.
   우리 수익 모델이 표준 통합 경로가 됐다는 뜻이고, 이건 마케팅 근거다.
3. **HIP-4 커버리지** — 예측시장이 8/31 메인넷 퍼미션리스 배포 개시. 새 자산군이다.

## 이미 확인한 것 (재조사 금지)

- HyENA dex 폐쇄 → 우리는 `xyz` 만 읽어 노출 0
- 상장폐지 → `isDelisted` 필터가 loadAssets·insights 양쪽에 있음
- deployerFeeScale=1.0 이 xyz 117종 전부 → 랜딩 문구 정정 완료 (커밋 578d685)

## 전수의 정의

- 경쟁자는 **실제로 열어본다**. 홈페이지 문구만 옮기지 않고, 무엇을 하는지/우리와 뭐가 겹치는지 표로 남긴다.
- 모든 주장에 URL 출처. 출처 없으면 "미확인" 표시.
- HIP-4 는 **API 로 실제 조회**해서 거래 가능한지 판정한다. 문서만 읽고 결론 내지 않는다.

---

- [x] G1: 경쟁자 조사 결과를 데이터로 남긴다 (각 항목 출처 URL, 우리와의 겹침 판정).
  CHECK: node -e "const d=require('/Users/minpro/dev/CODE4/BANKR/research/rivals.json'); const n=d.rivals.length; const bad=d.rivals.filter(r=>!r.source||!r.overlap).length; console.log('rivals='+n+' incomplete='+bad); process.exit(n>=2&&bad===0?0:1)"
  EXPECT: /rivals=\d+ incomplete=0/
  EVIDENCE: rivals=2 incomplete=0

- [x] G2: HIP-4 가 우리 주문 경로로 거래 가능한지 **API 로 판정**한다. 가능/불가 어느 쪽이든 근거를 남긴다.
  CHECK: cd /Users/minpro/ZCodeProject/agent-terminal && npx tsx scripts/probe-hip4.ts 2>&1 | tail -16
  EXPECT: /HIP4-VERDICT=/
  EVIDENCE: (hip-4-deployer-actions 문서는 배포자 액션만 다룬다). | → 추측으로 주소 체계를 만들지 않는다. 문서가 나오면 다시 본다.

- [x] G3: G2 결과에 따라 코드가 정합하다 — 거래 가능하면 커버리지에 포함, 불가하면 그 사실이 문서에 남는다.
  CHECK: cd /Users/minpro/ZCodeProject/agent-terminal && npx tsx scripts/test-coverage.ts 2>&1 | tail -12
  EXPECT: /COVERAGE OK/
  EVIDENCE: ✓ LiveTicker 가 실측 엔드포인트를 쓴다 | COVERAGE OK

- [x] G4: builder codes 채택 근거가 README 에 들어간다 (VALR·Base app·Oku, 출처 URL 포함).
  CHECK: cd /Users/minpro/ZCodeProject/agent-terminal && bash -c 'V=$(grep -c "VALR" README.md); B=$(grep -c "Base app" README.md); U=$(grep -c "valr.com\|baseapp" README.md); echo "valr=$V baseapp=$B urls=$U"; [ "$V" -ge 1 ] && [ "$B" -ge 1 ] && [ "$U" -ge 1 ] && echo EVIDENCE-OK || echo EVIDENCE-MISSING'
  EXPECT: /EVIDENCE-OK/
  EVIDENCE: valr=1 baseapp=1 urls=1 | EVIDENCE-OK

- [x] G5: 소셜 봇 전제 수정 — TradingView 가 HIP-3 데이터를 지원하므로
      "이 데이터는 잘 안 보인다"는 뉘앙스를 쓰지 않는다.
  CHECK: cd /Users/minpro/ZCodeProject/agent-terminal && npx tsx scripts/test-social.ts 2>&1 | tail -8
  EXPECT: /SOCIAL OK/
  EVIDENCE: ✓ 저장 실패를 경고 | SOCIAL OK — 안 나가야 할 것은 안 나간다

- [x] G6: 회귀 없음.
  CHECK: cd /Users/minpro/ZCodeProject/agent-terminal && bash -c 'npx tsx scripts/_reset-paper.ts >/dev/null 2>&1; F=0; N=0; for f in scripts/test-*.ts; do case "$f" in *deployed*|*posture*|*nosecrets*|*agent-e2e*) continue;; esac; N=$((N+1)); npx tsx "$f" >/dev/null 2>&1 || { echo "FAIL $f"; F=1; }; done; echo "ran=$N"; [ $F = 0 ] && echo NO-REGRESSION || echo REGRESSED'
  EXPECT: /NO-REGRESSION/
  EVIDENCE: ran=30 | NO-REGRESSION

- [x] G7: 빌드·타입 클린 + 시크릿 0.
  CHECK: cd /Users/minpro/ZCodeProject/agent-terminal && bash -c 'T=$(npx tsc --noEmit 2>&1 | wc -l | tr -d " "); B=$(npm run build 2>&1 | grep -c "Compiled successfully"); S=$(npx tsx scripts/test-nosecrets.ts 2>&1 | grep -c "NOSECRETS OK"); echo "tsc=$T build=$B secrets_ok=$S"; [ "$T" = 0 ] && [ "$B" -ge 1 ] && [ "$S" = 1 ] && echo BUILD-OK || echo BUILD-BROKEN'
  EXPECT: /BUILD-OK/
  EVIDENCE: tsc=0 build=1 secrets_ok=1 | BUILD-OK

- [x] G8: 플레이스홀더 0 + 커밋 완료.
  CHECK: cd /Users/minpro/ZCodeProject/agent-terminal && bash -c 'P=$(grep -rnE "TODO|FIXME|not implemented" lib/ scripts/ app/ bot/ 2>/dev/null | wc -l | tr -d " "); D=$(git status --porcelain | grep -c . | tr -d " "); echo "placeholders=$P dirty=$D"; [ "$P" = 0 ] && [ "$D" = 0 ] && echo CLEAN || echo DIRTY'
  EXPECT: /CLEAN/
  EVIDENCE: placeholders=0 dirty=0 | CLEAN

<!--
- 체크박스는 gate-check.mjs 가 CHECK 실행 후 EXPECT 매칭되면 뒤집는다.
- EVIDENCE가 pending인 채로 체크된 박스는 미달로 친다.
- 불가능해진 게이트는 삭제하지 말고 ABANDON: G<n> <사유> 를 추가한다.
-->
