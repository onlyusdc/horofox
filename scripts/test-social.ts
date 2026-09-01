// G3 — 소셜 봇. 사람이 검토하지 않고 글이 나가므로, 여기서 못 막으면 아무도 못 막는다.
import "../lib/env";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import { draftsFrom, assertNoPromise, assertFits, MAX_LEN } from "../bot/social/templates";
import type { Insights } from "../lib/insights";

const run = (args: string[], env: NodeJS.ProcessEnv = process.env) =>
  new Promise<string>((res) => {
    const p = spawn("npx", ["tsx", "bot/social/run.ts", ...args], { env });
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (out += d));
    p.on("close", () => res(out));
  });

const fake = (over: Partial<Insights> = {}): Insights => ({
  topFunding: [{ symbol: "TSLA", hourly: 0.0001, annualisedPct: 87.6, markPx: 400, dayNtlVlm: 1e6, kind: "equity" }],
  bottomFunding: [{ symbol: "AAPL", hourly: -0.0001, annualisedPct: -87.6, markPx: 200, dayNtlVlm: 1e6, kind: "equity" }],
  topMoves: [{ symbol: "NVDA", markPx: 220, prevDayPx: 200, changePct: 10, dayNtlVlm: 1e6, kind: "equity" }],
  coverage: {
    total: 280, crypto: 177, hip3: 103, equities: 92, indicesCommodities: 11,
    dexes: ["xyz"], sampleEquities: ["TSLA"], measuredAt: new Date().toISOString(),
  },
  measuredAt: new Date().toISOString(),
  ...over,
});

async function main() {
  let fail = 0;
  const t = (n: string, ok: boolean, x = "") => { if (!ok) fail++; console.log(`  ${ok ? "✓" : "✗"} ${n}${x ? "  " + x : ""}`); };

  console.log("게시 문구 — 숫자는 전부 insights 에서 온다");
  const d = draftsFrom(fake());
  t("초안이 만들어짐", d.length >= 2, `${d.length}건`);
  const all = d.map((x) => x.text).join("\n");
  console.log(all.split("\n").map((l) => "     " + l).join("\n"));

  // 문구에 등장하는 모든 수치가 insights 값에서 유래했는지 — 지어낸 숫자가 없어야 한다
  const ins = fake();
  const allowed = new Set<string>();
  for (const r of [...ins.topFunding, ...ins.topMoves]) {
    for (const v of Object.values(r)) if (typeof v === "number") { allowed.add(String(v)); allowed.add(v.toFixed(1)); allowed.add(Math.abs(v).toFixed(1)); }
  }
  for (const v of Object.values(ins.coverage)) if (typeof v === "number") allowed.add(String(v));
  // "HIP-3" 의 3, "24h" 의 24 는 시장 데이터가 아니라 고유명사·단위다. 먼저 걷어낸다.
  const prose = all.replace(/HIP-3/g, "HIP").replace(/\b24h\b/g, "daily");
  const nums = [...prose.matchAll(/\d+(?:\.\d+)?/g)].map((m) => m[0]);
  const orphan = nums.filter((n) => !allowed.has(n) && !allowed.has(Number(n).toFixed(1)));
  t("문구의 모든 숫자가 insights 유래", orphan.length === 0, orphan.join(","));

  console.log("\n데이터가 없으면 문구를 지어내지 않는다");
  const empty = draftsFrom(fake({ topFunding: [], topMoves: [] }));
  t("펀딩·변동 초안이 사라짐", !empty.some((x) => x.kind === "funding" || x.kind === "move"));
  t("커버리지 초안은 남음", empty.some((x) => x.kind === "coverage"));

  console.log("\n수익 약속 금지");
  for (const x of d) t(`${x.kind}: 약속 표현 0건`, (() => { try { assertNoPromise(x.text); return true; } catch { return false; } })());
  t("guaranteed 는 던진다", (() => { try { assertNoPromise("guaranteed profit"); return false; } catch { return true; } })());
  t("risk-free 는 던진다", (() => { try { assertNoPromise("This is risk-free"); return false; } catch { return true; } })());
  t("100x 는 던진다", (() => { try { assertNoPromise("could do 100x"); return false; } catch { return true; } })());

  console.log("\n길이 — 자르지 않고 던진다 (잘린 숫자는 틀린 숫자다)");
  for (const x of d) t(`${x.kind}: X 280자에 링크까지 들어감`, (() => { try { assertFits(x.text, "x", x.link); return true; } catch { return false; } })(), `${x.text.length}+${x.link?.length ?? 0}`);
  t("초과하면 던진다", (() => { try { assertFits("a".repeat(300), "x"); return false; } catch { return true; } })());
  t("링크 길이도 센다", (() => { try { assertFits("a".repeat(MAX_LEN.x - 5), "x", "https://example.com"); return false; } catch { return true; } })());

  console.log("\n실행기 — dry-run 이 기본인가");
  const out = await run(["--channel", "all", "--once", "--dry-run"]);
  t("DRY-RUN 으로 시작", out.includes("DRY-RUN"));
  t("--live 없이는 절대 게시하지 않음", !out.includes("게시 완료") && !out.includes("답글 완료"));
  t("배너가 읽기는 한다고 정직하게 밝힘", out.includes("읽기는 합니다"));
  t("자격증명 없으면 발급 방법 안내", out.includes("neynar.com") && out.includes("developer.x.com"));
  t("X 링크 비용을 경고", out.includes("$0.20"));
  t("미설정 채널은 멘션 조회를 건너뜀", out.includes("자격증명이 없어 멘션 조회를 건너뜁니다"));
  t("예상 비용을 표시", /비용 예상 \$/.test(out));

  console.log("\n--live 만으로는 안 되고 SOCIAL_DRY_RUN=0 도 필요");
  const liveOnly = await run(["--channel", "farcaster", "--once", "--live"], { ...process.env, SOCIAL_DRY_RUN: "1" });
  t("--live 단독이면 여전히 dry-run", liveOnly.includes("DRY-RUN"));

  console.log("\n두뇌 재사용 — 에이전트 로직을 복제하지 않는다");
  const runSrc = await fs.readFile("bot/social/run.ts", "utf8");
  t("runAgent 를 경유", runSrc.includes("runAgent"));
  t("generateText 를 직접 부르지 않음", !runSrc.includes("generateText"));

  console.log("\n중복 답글 방지 장치가 있는가");
  t("처리한 멘션 id 를 기록", runSrc.includes("replied"));
  t("기록된 id 는 건너뜀", /replied\.includes/.test(runSrc));
  t("저장 실패를 경고", runSrc.includes("중복 답글이 날 수 있습니다"));

  console.log(fail === 0 ? "\nSOCIAL OK — 안 나가야 할 것은 안 나간다" : `\nSOCIAL FAIL — ${fail}건`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error("SOCIAL FAIL —", e instanceof Error ? e.message : e); process.exit(1); });
