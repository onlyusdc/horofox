// G11 — REST API 실호출. 서버를 실제로 띄워서 응답을 확인한다.
// 페이퍼 모드로 돌린다 (실주문 없음).
import "../lib/env";
import { spawn } from "node:child_process";

const PORT = 3457;
const BASE = `http://127.0.0.1:${PORT}/api/v1`;

async function waitReady(ms = 180_000): Promise<boolean> {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try {
      const r = await fetch(`${BASE}/portfolio`);
      if (r.ok) return true;
    } catch { /* 아직 안 뜸 */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function main() {
  let fail = 0;
  const t = (n: string, ok: boolean, extra = "") => { if (!ok) fail++; console.log(`  ${ok ? "✓" : "✗"} ${n}${extra ? "  " + extra : ""}`); };

  console.log(`Next dev 서버 기동 (포트 ${PORT}, 페이퍼 모드)…`);
  const env = { ...process.env, HL_MODE: "paper", HL_BUILDER_ADDRESS: "0x1111111111111111111111111111111111111111", AGENT_API_KEY: "" };
  const srv = spawn("npx", ["next", "dev", "-p", String(PORT)], { env, stdio: "ignore", detached: true });

  const cleanup = () => { try { process.kill(-srv.pid!, "SIGKILL"); } catch { /* 이미 죽음 */ } };
  process.on("exit", cleanup);

  try {
    if (!await waitReady()) { console.log("\nREST FAIL — 서버가 뜨지 않음"); cleanup(); process.exit(1); }
    console.log("  서버 준비됨\n");

    // 1) 포트폴리오
    const pf = await (await fetch(`${BASE}/portfolio`)).json();
    t("GET /portfolio 응답", typeof pf === "object" && pf !== null);

    // 2) 퍼프 시세 — 메인 dex
    const btc = await (await fetch(`${BASE}/perp-price?coin=BTC`)).json() as { ok?: boolean; mid?: number };
    t("GET /perp-price?coin=BTC", btc.ok === true && (btc.mid ?? 0) > 1000, `$${btc.mid}`);

    // 3) 퍼프 시세 — HIP-3 (머지의 핵심: 이게 되면 SK하이닉스가 서비스에 붙은 것)
    const skhx = await (await fetch(`${BASE}/perp-price?coin=SKHX`)).json() as { ok?: boolean; mid?: number };
    t("GET /perp-price?coin=SKHX (SK하이닉스)", skhx.ok === true && (skhx.mid ?? 0) > 0, `$${skhx.mid}`);

    const dram = await (await fetch(`${BASE}/perp-price?coin=DRAM`)).json() as { ok?: boolean; mid?: number };
    t("GET /perp-price?coin=DRAM (D램 지수)", dram.ok === true && (dram.mid ?? 0) > 0, `$${dram.mid}`);

    // 4) 포지션
    const perps = await (await fetch(`${BASE}/perps`)).json() as { positions?: unknown[]; note?: string };
    t("GET /perps 응답", Array.isArray(perps.positions));
    t("페이퍼 모드임이 응답에 표기됨", (perps.note ?? "").includes("페이퍼"), perps.note);

    // 5) 수익 — 실수익 블록이 노출되는가
    const rev = await (await fetch(`${BASE}/revenue`)).json() as { real?: { builderFeesUsdc?: number; configured?: boolean }; paperRevenueUsdc?: number };
    t("GET /revenue 에 real 블록", typeof rev.real === "object" && rev.real !== null);
    t("real.builderFeesUsdc 노출", typeof rev.real?.builderFeesUsdc === "number", `$${rev.real?.builderFeesUsdc}`);
    t("페이퍼 매출과 분리 표기", typeof rev.paperRevenueUsdc === "number");

    // 6) 없는 심볼은 400
    const bad = await fetch(`${BASE}/perp-price?coin=NOTACOIN`);
    t("없는 심볼 → 400", bad.status === 400);

    // 7) 진입 시도 (페이퍼) — 잔고 부족이든 성공이든 500 이 아니어야 한다
    const open = await fetch(`${BASE}/perp`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ coin: "BTC", direction: "long", marginUsdc: 50, leverage: 2 }) });
    t("POST /perp 이 5xx 없이 처리됨", open.status < 500, `HTTP ${open.status}`);

    console.log(fail === 0 ? "\nREST OK — 서버가 HIP-3 자산까지 실제로 서빙" : `\nREST FAIL — ${fail}건`);
  } finally {
    cleanup();
  }
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error("REST FAIL —", e instanceof Error ? e.message : e); process.exit(1); });
