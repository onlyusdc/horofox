// G1 — 게시 소재가 실측인가. 지어낸 숫자가 하나라도 있으면 서비스 전체가 거짓이 된다.
import "../lib/env";
import fs from "node:fs/promises";
import { gatherInsights, annualisedPct } from "../lib/insights";

async function main() {
  let fail = 0;
  const t = (n: string, ok: boolean, x = "") => { if (!ok) fail++; console.log(`  ${ok ? "✓" : "✗"} ${n}${x ? "  " + x : ""}`); };

  console.log("연율 환산 (순수)");
  t("시간당 0.0001 → 87.6%", Math.abs(annualisedPct(0.0001) - 87.6) < 1e-9, `${annualisedPct(0.0001)}`);
  t("0 은 0", annualisedPct(0) === 0);
  t("음수 부호 보존", annualisedPct(-0.0001) < 0);

  console.log("\n실측 (Hyperliquid 라이브)");
  const ins = await gatherInsights(3);
  const f = ins.topFunding[0];
  const b = ins.bottomFunding[0];
  const m = ins.topMoves[0];
  console.log(`  펀딩 최고  ${f?.symbol} ${f?.annualisedPct.toFixed(1)}%/yr  (시간당 ${f?.hourly})`);
  console.log(`  펀딩 최저  ${b?.symbol} ${b?.annualisedPct.toFixed(1)}%/yr`);
  console.log(`  변동 최대  ${m?.symbol} ${m?.changePct.toFixed(2)}%  $${m?.prevDayPx} → $${m?.markPx}`);
  console.log(`  커버리지   ${ins.coverage.total} = ${ins.coverage.crypto} + ${ins.coverage.hip3} (주식 ${ins.coverage.equities})`);

  t("펀딩 순위가 채워짐", ins.topFunding.length > 0, `${ins.topFunding.length}건`);
  t("변동 순위가 채워짐", ins.topMoves.length > 0, `${ins.topMoves.length}건`);
  t("기본은 주식만 (우리 차별점)", ins.topFunding.every((r) => r.kind === "equity"));
  t("연율이 시간당 값과 일치", ins.topFunding.every((r) => Math.abs(r.annualisedPct - annualisedPct(r.hourly)) < 1e-9));
  t("최고 ≥ 최저", (ins.topFunding[0]?.hourly ?? 0) >= (ins.bottomFunding[0]?.hourly ?? 0));
  t("변동이 절대값 내림차순", ins.topMoves.every((r, i, a) => i === 0 || Math.abs(a[i - 1]!.changePct) >= Math.abs(r.changePct)));
  t("변동률이 가격과 일치", ins.topMoves.every((r) => Math.abs(r.changePct - ((r.markPx - r.prevDayPx) / r.prevDayPx) * 100) < 1e-6));
  t("모든 가격이 양수 (0 으로 메우지 않음)", [...ins.topFunding, ...ins.topMoves].every((r) => r.markPx > 0));
  t("모든 수치가 유한", ins.topFunding.every((r) => Number.isFinite(r.hourly) && Number.isFinite(r.dayNtlVlm)));
  t("커버리지 합계 정합", ins.coverage.total === ins.coverage.crypto + ins.coverage.hip3);
  t("측정 시각 유효", !Number.isNaN(Date.parse(ins.measuredAt)));

  console.log("\n주식 외 포함 모드");
  const all = await gatherInsights(5, false);
  t("지수·원자재도 들어옴", all.topFunding.length >= ins.topFunding.length);

  console.log("\n하드코딩 금지");
  const src = await fs.readFile("lib/insights.ts", "utf8");
  const code = src.split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*")).join("\n");
  // 연율 환산의 24·365·100 과 기본 limit/szDecimals 외에 고정 수치가 있으면 안 된다
  const nums = [...code.matchAll(/(?<![\w.])\d{2,}(?![\w.])/g)].map((m) => m[0]).filter((n) => !["24", "365", "100"].includes(n));
  t("환산 상수 외 고정 수치 없음", nums.length === 0, nums.join(","));
  t("심볼 목록을 박아두지 않음", !/["'](TSLA|NVDA|AAPL|SKHX)["']/.test(code));

  console.log(fail === 0 ? "\nINSIGHTS OK — 전부 실측" : `\nINSIGHTS FAIL — ${fail}건`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error("INSIGHTS FAIL —", e instanceof Error ? e.message : e); process.exit(1); });
