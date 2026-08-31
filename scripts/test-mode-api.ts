// G7 — /api/v1/mode. 개인키가 새면 안 된다.
import "../lib/env";
import { spawn } from "node:child_process";

const PORT = 3459;
const KEY = "0x" + "33".repeat(32);
const BUILDER = "0x4444444444444444444444444444444444444444";

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

  const env = { ...process.env, HL_MODE: "live", HL_TRADER_KEY: KEY, HL_BUILDER_ADDRESS: BUILDER, AGENT_API_KEY: "" };
  const srv = spawn("npx", ["next", "dev", "-p", String(PORT)], { env, stdio: "ignore", detached: true });
  const cleanup = () => { try { process.kill(-srv.pid!, "SIGKILL"); } catch { /* 이미 종료 */ } };
  process.on("exit", cleanup);

  try {
    const url = `http://127.0.0.1:${PORT}/api/v1/mode`;
    if (!await waitReady(url)) { console.log("\nMODE-API FAIL — 서버가 뜨지 않음"); cleanup(); process.exit(1); }

    const res = await fetch(url);
    const body = await res.text();
    const j = JSON.parse(body) as Record<string, unknown>;
    console.log(`  응답: ${body.slice(0, 190)}\n`);

    t("HTTP 200", res.ok);
    t("mode=live (3조건 충족)", j.mode === "live");
    t("trader 주소 노출", typeof j.trader === "string" && /^0x[0-9a-fA-F]{40}$/.test(j.trader as string));
    t("builder 주소 노출", (j.builder as string)?.toLowerCase() === BUILDER);
    t("feePercent 노출", j.feePercent === 0.1);
    t("network 표기", j.network === "mainnet" || j.network === "testnet");

    // 가장 중요한 검사
    t("개인키가 응답에 없음", !body.includes(KEY) && !body.includes(KEY.slice(2)));
    t("privateKey/key 같은 필드명 없음", !/private|secret|"key"/i.test(body));

    console.log(fail === 0 ? "\nMODE-API OK — 키 노출 없음" : `\nMODE-API FAIL — ${fail}건`);
  } finally { cleanup(); }
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error("MODE-API FAIL —", e instanceof Error ? e.message : e); process.exit(1); });
