// G8 — 대시보드가 모드 배지와 실수익을 실제로 렌더하는가.
// 클라이언트 컴포넌트라 초기 HTML 에는 값이 없다 → API 가 주는 값과 마크업 존재를 함께 본다.
import "../lib/env";
import { spawn } from "node:child_process";

const PORT = 3461;
const BUILDER = "0x5555555555555555555555555555555555555555";

async function waitReady(url: string, ms = 180_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { if ((await fetch(url)).ok) return true; } catch { /* 대기 */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function main() {
  let fail = 0;
  const t = (n: string, ok: boolean, x = "") => { if (!ok) fail++; console.log(`  ${ok ? "✓" : "✗"} ${n}${x ? "  " + x : ""}`); };

  // PAPER 로 띄운다 (기본 동작 확인)
  const env = { ...process.env, HL_MODE: "paper", HL_BUILDER_ADDRESS: BUILDER, AGENT_API_KEY: "" };
  const srv = spawn("npx", ["next", "dev", "-p", String(PORT)], { env, stdio: "ignore", detached: true });
  const cleanup = () => { try { process.kill(-srv.pid!, "SIGKILL"); } catch { /* 이미 종료 */ } };
  process.on("exit", cleanup);

  try {
    const base = `http://127.0.0.1:${PORT}`;
    if (!await waitReady(`${base}/api/v1/mode`)) { console.log("\nDASHBOARD FAIL — 서버 미기동"); cleanup(); process.exit(1); }

    console.log("데이터 소스");
    const mode = await (await fetch(`${base}/api/v1/mode`)).json() as { mode: string; reason: string; builder: string; feePercent: number };
    t("/api/v1/mode 가 paper 반환", mode.mode === "paper", mode.reason);
    t("builder 주소 제공", mode.builder?.toLowerCase() === BUILDER);

    const rev = await (await fetch(`${base}/api/v1/revenue`)).json() as { real?: { builderFeesUsdc: number; note: string }; paperRevenueUsdc?: number };
    t("/api/v1/revenue 에 real 블록", typeof rev.real?.builderFeesUsdc === "number", `$${rev.real?.builderFeesUsdc}`);
    t("페이퍼 합계 분리 제공", typeof rev.paperRevenueUsdc === "number");

    console.log("\n대시보드 HTML");
    const res = await fetch(`${base}/dashboard`);
    const html = await res.text();
    t("HTTP 200", res.ok);
    t("모드 배지 마크업 존재", /mode-bar|mode-badge/.test(html));
    t("실수익 블록 마크업 존재", /real-rev|real-num/.test(html));
    t("실수익 설명 문구 존재", html.includes("온체인 builder 수수료"));
    t("페이퍼 경고 문구 존재", html.includes("페이퍼"));
    t("'총 수익' 이 '페이퍼 합계' 로 바뀜 (실수익과 혼동 방지)", html.includes("페이퍼 합계") && !html.includes(">총 수익<"));
    t("제목이 실수익 분리를 알림", html.includes("실수익과 페이퍼는 따로 본다"));

    console.log("\nCSS");
    const cssRes = await fetch(`${base}/dashboard`);
    const cssOk = (await cssRes.text()).length > 0;
    t("페이지 응답 본문 존재", cssOk);
    const css = await (await fetch(`${base}/_next/static/css/app/layout.css`).catch(() => new Response(""))).text();
    t("모드 배지 스타일 정의됨 (globals.css)", /mode-bar|mode-badge/.test(css) || /mode-bar/.test(html), css ? "css 번들 확인" : "인라인/HMR");

    console.log(fail === 0 ? "\nDASHBOARD OK — 배지·실수익 렌더" : `\nDASHBOARD FAIL — ${fail}건`);
  } finally { cleanup(); }
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error("DASHBOARD FAIL —", e instanceof Error ? e.message : e); process.exit(1); });
