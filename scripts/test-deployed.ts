// G4/G5 — 배포된 사이트가 실제로 뜨고, 진짜 Hyperliquid 데이터를 서빙하는가.
import "../lib/env";

const BASE = process.env.DEPLOY_URL ?? "https://agent-terminal.xpost.workers.dev";
const DATA_ONLY = process.argv.includes("--data");

async function main() {
  let fail = 0;
  const t = (n: string, ok: boolean, x = "") => { if (!ok) fail++; console.log(`  ${ok ? "✓" : "✗"} ${n}${x ? "  " + x : ""}`); };
  const get = (p: string) => fetch(`${BASE}${p}`, { headers: { "user-agent": "agent-terminal-selftest" } });

  console.log(`대상: ${BASE}\n`);

  if (!DATA_ONLY) {
    console.log("페이지");
    const home = await get("/");
    const html = await home.text();
    t("랜딩 200", home.status === 200, `HTTP ${home.status}`);
    t("훅 헤드라인 렌더", html.includes("온체인에서 산다"));
    t("정직성 섹션 렌더", html.includes("수익을 약속하지 않습니다"));
    t("백테스트 수치 노출", html.includes("5.65"));
    t("읽기 전용 고지", html.includes("읽기 전용"));
    t("규제 경고", html.includes("무인가 금융투자업"));

    const dash = await get("/dashboard");
    t("대시보드 200", dash.status === 200, `HTTP ${dash.status}`);
    const term = await get("/terminal");
    t("터미널 200", term.status === 200, `HTTP ${term.status}`);

    console.log("\n보안");
    t("응답에 OpenAI 키가 없음", !/sk-[A-Za-z0-9]{20,}/.test(html));
    t("응답에 개인키가 없음", !/0x[0-9a-fA-F]{64}/.test(html));

    console.log(fail === 0 ? "\nDEPLOY OK — 공개 URL 동작" : `\nDEPLOY FAIL — ${fail}건`);
    process.exit(fail === 0 ? 0 : 1);
  }

  // ── 실데이터 검증 ────────────────────────────────────
  console.log("실 Hyperliquid 데이터 (목데이터가 아님을 확인)");
  const mode = await (await get("/api/v1/mode")).json() as { ok?: boolean; mode?: string; network?: string };
  t("/api/v1/mode 응답", mode.ok === true, `mode=${mode.mode} net=${mode.network}`);
  t("배포본은 PAPER (실주문 안 나감)", mode.mode === "paper");

  const btc = await (await get("/api/v1/perp-price?coin=BTC")).json() as { ok?: boolean; mid?: number };
  t("BTC 시세 서빙", btc.ok === true && (btc.mid ?? 0) > 1000, `$${btc.mid}`);

  // HIP-3 — 이게 되면 배포본이 우리 엔진을 실제로 돌리고 있는 것
  const skhx = await (await get("/api/v1/perp-price?coin=SKHX")).json() as { ok?: boolean; mid?: number };
  t("SKHX(SK하이닉스, HIP-3) 서빙", skhx.ok === true && (skhx.mid ?? 0) > 0, `$${skhx.mid}`);
  const dram = await (await get("/api/v1/perp-price?coin=DRAM")).json() as { ok?: boolean; mid?: number };
  t("DRAM(D램 지수, HIP-3) 서빙", dram.ok === true && (dram.mid ?? 0) > 0, `$${dram.mid}`);
  const nvda = await (await get("/api/v1/perp-price?coin=NVDA")).json() as { ok?: boolean; mid?: number };
  t("NVDA(엔비디아, HIP-3) 서빙 — 훅의 근거", nvda.ok === true && (nvda.mid ?? 0) > 0, `$${nvda.mid}`);

  // 라이브 대조: 배포본 값이 거래소 값과 근접한가 (목데이터면 안 맞는다)
  const live = await (await fetch("https://api.hyperliquid.xyz/info", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: "allMids" }),
  })).json() as Record<string, string>;
  const liveBtc = Number(live["BTC"]);
  const drift = Math.abs((btc.mid ?? 0) - liveBtc) / liveBtc;
  t("배포본 BTC 가 거래소 값과 1% 이내", drift < 0.01, `배포 $${btc.mid} vs 거래소 $${liveBtc}`);

  const rev = await (await get("/api/v1/revenue")).json() as { real?: { builderFeesUsdc?: number } };
  t("/api/v1/revenue 에 실수익 블록", typeof rev.real?.builderFeesUsdc === "number");

  const bad = await get("/api/v1/perp-price?coin=NOTACOIN");
  t("없는 심볼 → 400", bad.status === 400);

  console.log(fail === 0 ? "\nLIVE-DATA OK — 실제 HL 데이터, HIP-3 포함" : `\nLIVE-DATA FAIL — ${fail}건`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error("DEPLOY FAIL —", e instanceof Error ? e.message : e); process.exit(1); });
