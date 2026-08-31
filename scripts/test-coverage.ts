// G4 — 자산 커버리지가 하드코딩이 아니라 실측인가.
// 이전 랜딩은 `177 + hip3` 로 총계를 만들었다. 그 숫자의 출처가 없었다.
import "../lib/env";
import { measureCoverage, classify } from "../lib/coverage";
import type { AssetMeta } from "../lib/hl/core";

let fail = 0;
const t = (n: string, ok: boolean, x = "") => { if (!ok) fail++; console.log(`  ${ok ? "✓" : "✗"} ${n}${x ? "  " + x : ""}`); };

const asset = (o: Partial<AssetMeta>): AssetMeta =>
  ({ index: 0, name: "X", symbol: "X", szDecimals: 2, maxLeverage: 10, dex: null, ...o });

import fs from "node:fs/promises";

async function main() {
  console.log("분류 규칙 (순수)");
  t("메인 dex = 크립토", classify(asset({ symbol: "BTC", dex: null })) === "crypto");
  t("HIP-3 주식 심볼 = 주식", classify(asset({ symbol: "SKHX", dex: "xyz" })) === "equity");
  t("SP500 은 주식이 아니라 지수", classify(asset({ symbol: "SP500", dex: "xyz" })) === "index");
  t("GOLD 는 원자재", classify(asset({ symbol: "GOLD", dex: "xyz" })) === "index");
  t("대소문자 무관", classify(asset({ symbol: "gold", dex: "xyz" })) === "index");

  console.log("\n실측 (Hyperliquid 라이브)");
  const c = await measureCoverage();
  console.log(`  총 ${c.total}종 = 크립토 ${c.crypto} + HIP-3 ${c.hip3}(주식 ${c.equities} / 지수·원자재 ${c.indicesCommodities})`);
  console.log(`  dex: ${c.dexes.join(", ") || "(없음)"} · 표본: ${c.sampleEquities.join(" ") || "(없음)"}`);

  t("자산을 실제로 읽었다", c.total > 0, `total=${c.total}`);
  t("합계가 부분의 합과 일치 (날조 없음)", c.total === c.crypto + c.hip3, `${c.total} vs ${c.crypto}+${c.hip3}`);
  t("HIP-3 = 주식 + 지수·원자재", c.hip3 === c.equities + c.indicesCommodities);
  t("크립토가 100종 이상 (메인 dex 를 읽고 있음)", c.crypto >= 100, `crypto=${c.crypto}`);
  t("HIP-3 자산이 존재 (우리 우위의 근거)", c.hip3 > 0, `hip3=${c.hip3}`);
  t("토큰화 주식이 존재", c.equities > 0, `equities=${c.equities}`);
  t("표본을 제시한다 (검증 가능)", c.sampleEquities.length > 0);
  t("측정 시각을 남긴다", !Number.isNaN(Date.parse(c.measuredAt)));

  console.log("\n하드코딩 금지 — 코드에 상수 총계가 없는가");
  const src = await fs.readFile("lib/coverage.ts", "utf8");
  // 주석에 적힌 과거 이력은 하드코딩이 아니다. 실행되는 줄만 본다.
  const code = (x: string) => x.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  t("coverage.ts 에 '177' 같은 고정 총계 없음", !/\b(177|280)\b/.test(code(src)));
  const ticker = await fs.readFile("components/LiveTicker.tsx", "utf8");
  t("LiveTicker 도 고정 총계를 쓰지 않음", !/\b177\b/.test(code(ticker)));
  t("LiveTicker 가 실측 엔드포인트를 쓴다", ticker.includes("/api/v1/metrics"));

  console.log(fail === 0 ? "\nCOVERAGE OK" : `\nCOVERAGE FAIL — ${fail}건`);
  process.exit(fail === 0 ? 0 : 1);

}

main().catch((e) => { console.error('COVERAGE FAIL —', e instanceof Error ? e.message : e); process.exit(1); });
