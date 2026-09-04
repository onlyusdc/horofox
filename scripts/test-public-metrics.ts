// G3 — 공개 지표. 규칙 하나만 지키면 된다: 실거래와 페이퍼를 합산하지 않는다.
//
// 이걸 "안 하겠다"는 약속이 아니라 **구조**로 만든다.
// 데이터에 합계 필드가 아예 없어야 하고, 화면에도 없어야 한다.
import "../lib/env";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";

const PORT = 3476;

async function main() {
  let fail = 0;
  const t = (n: string, ok: boolean, x = "") => { if (!ok) fail++; console.log(`  ${ok ? "✓" : "✗"} ${n}${x ? "  " + x : ""}`); };

  const { publicMetrics } = await import("../lib/metrics");
  const m = await publicMetrics();

  console.log("구조 — 합산이 불가능한 모양인가");
  // 두 섹션이 같은 필드명을 공유하면 "합쳐도 되는 값"처럼 보인다. 이름부터 겹치지 않게 둔다.
  const shared = Object.keys(m.live).filter((k) => k in m.paper);
  t("live 와 paper 가 필드명을 공유하지 않음", shared.length === 0, shared.join(","));
  const top = Object.keys(m);
  t("최상위에 합계 필드 없음", !top.some((k) => /total|sum|combined|all/i.test(k) && k !== "coverage"), top.join(","));
  t("합산 금지를 응답에 명시", m.disclaimer === "live and paper are never summed");

  console.log("\n어떤 필드도 두 값을 더한 값이 아닌가");
  const liveNums = Object.values(m.live).filter((v): v is number => typeof v === "number");
  const paperNums = Object.values(m.paper).filter((v): v is number => typeof v === "number");
  const allNums = [...liveNums, ...paperNums, ...Object.values(m.coverage).filter((v): v is number => typeof v === "number")];
  // 한쪽이 0 이면 a+b 가 다른 쪽 값 자신과 같아져 의미가 없다. 둘 다 0 이 아닌 조합만 본다.
  const sums = liveNums.filter((a) => a > 0).flatMap((a) => paperNums.filter((b) => b > 0).map((b) => a + b));
  const collision = allNums.find((n) => n > 0 && sums.includes(n));
  t("live+paper 와 같은 값을 노출하는 필드 없음", collision === undefined, collision === undefined ? "" : `충돌값=${collision}`);

  console.log("\n페이퍼는 페이퍼라고 표시되는가");
  const page = await fs.readFile("app/metrics/page.tsx", "utf8");
  t("화면이 paper 섹션에 배지를 붙임", page.includes("badge-paper") && page.includes("common.paper"));
  t("화면이 live 섹션에 모드를 표시", page.includes("m.live.mode"));
  t("화면에 두 섹션을 더하는 연산 없음", !/m\.live\.\w+\s*\+\s*m\.paper|m\.paper\.\w+\s*\+\s*m\.live/.test(page));

  console.log("\n내용 — 실제로 측정된 값인가");
  t("커버리지 총계 > 0", m.coverage.total > 0, `total=${m.coverage.total}`);
  t("live 모드 값이 live|paper", ["live", "paper"].includes(m.live.mode), m.live.mode);
  t("모든 수치가 유한", allNums.every((n) => Number.isFinite(n)));
  t("음수 수치 없음", allNums.every((n) => n >= 0));
  t("측정 시각 유효", !Number.isNaN(Date.parse(m.measuredAt)));

  console.log(`\n  live: 수수료 ${m.live.builderFeesUsdc} / 전환 ${m.live.convertedToCreditsUsd} / 호출 ${m.live.fundedCalls} (${m.live.mode})`);
  console.log(`  paper: 런치패드 ${m.paper.launchpadFeesUsdc} / 스왑 ${m.paper.swapFeesUsdc} / 거래 ${m.paper.trades}`);
  console.log(`  coverage: ${m.coverage.total} = ${m.coverage.crypto} + ${m.coverage.hip3}`);

  console.log("\nHTTP — 공개 엔드포인트");
  const srv = spawn("npx", ["next", "dev", "-p", String(PORT)], { stdio: "ignore", detached: true });
  const kill = () => { try { process.kill(-srv.pid!, "SIGKILL"); } catch { /* 이미 종료 */ } };
  try {
    const url = `http://127.0.0.1:${PORT}/api/v1/metrics`;
    const t0 = Date.now();
    let res: Response | null = null;
    while (Date.now() - t0 < 180_000) {
      try { const r = await fetch(url); if (r.status < 500) { res = r; break; } } catch { /* 대기 */ }
      await new Promise((r) => setTimeout(r, 1000));
    }
    t("인증 없이 200 (숫자가 곧 마케팅이다)", res?.status === 200, `HTTP ${res?.status}`);
    const body = (await res?.json()) as Record<string, unknown> | undefined;
    t("live/paper/coverage 모두 반환", !!body && "live" in body && "paper" in body && "coverage" in body);
    t("개인 데이터 없음", !/users?\.json|agentKey|0x[0-9a-fA-F]{40,}/.test(JSON.stringify(body ?? {})));

    const html = await fetch(`http://127.0.0.1:${PORT}/metrics`).then((r) => r.text()).catch(() => "");
    t("/metrics 페이지가 뜬다", html.includes("horofox"), `${html.length} bytes`);
  } finally { kill(); }

  console.log(fail === 0 ? "\nMETRICS OK — 실거래와 페이퍼가 분리됨" : `\nMETRICS FAIL — ${fail}건`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error("METRICS FAIL —", e instanceof Error ? e.message : e); process.exit(1); });
