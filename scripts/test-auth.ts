// G2 — 인증. 헤더 하나로 남의 계정이 되면 안 된다.
import "../lib/env";
import { spawn } from "node:child_process";

const PORT = 3463;
const OP_KEY = "operator-secret-key";
const ALICE_KEY = "alice-secret-key";
const BOB_KEY = "bob-secret-key";

async function waitReady(url: string, ms = 180_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { const r = await fetch(url); if (r.status < 500) return true; } catch { /* 대기 */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function main() {
  let fail = 0;
  const t = (n: string, ok: boolean, x = "") => { if (!ok) fail++; console.log(`  ${ok ? "✓" : "✗"} ${n}${x ? "  " + x : ""}`); };

  // ── 순수 함수 검증 (서버 없이) ──────────────────────────
  process.env.AGENT_API_KEY = OP_KEY;
  process.env.USER_API_KEYS = `alice:${ALICE_KEY},bob:${BOB_KEY}`;
  const { identify, tradeContextOf } = await import("../lib/auth");
  const req = (h: Record<string, string> = {}) => new Request("http://x/", { headers: h });

  console.log("신원 판정");
  t("토큰 없으면 거부", identify(req()) === null);
  t("틀린 토큰 거부", identify(req({ authorization: "Bearer nope" })) === null);
  t("운영자 키 → operator", identify(req({ authorization: `Bearer ${OP_KEY}` }))?.scope === "operator");
  t("alice 키 → alice", identify(req({ authorization: `Bearer ${ALICE_KEY}` }))?.userId === "alice");
  t("bob 키 → bob", identify(req({ authorization: `Bearer ${BOB_KEY}` }))?.userId === "bob");

  console.log("\n핵심: 헤더로 신원을 위조할 수 있는가");
  t("X-User-Id 헤더는 무시됨", identify(req({ "x-user-id": "alice" })) === null);
  t("alice 키 + bob 헤더 → 여전히 alice", identify(req({ authorization: `Bearer ${ALICE_KEY}`, "x-user-id": "bob" }))?.userId === "alice");
  t("운영자 키 + alice 헤더 → 여전히 operator(userId null)", identify(req({ authorization: `Bearer ${OP_KEY}`, "x-user-id": "alice" }))?.userId === null);
  t("body 의 userId 도 신원에 영향 없음 (identify 는 헤더만 본다)", identify(req({ authorization: `Bearer ${BOB_KEY}` }))?.userId === "bob");

  console.log("\n컨텍스트 변환");
  t("유저 → { userId }", tradeContextOf(identify(req({ authorization: `Bearer ${ALICE_KEY}` })))?.userId === "alice");
  t("운영자 → undefined (기존 동작)", tradeContextOf(identify(req({ authorization: `Bearer ${OP_KEY}` }))) === undefined);
  t("익명 → undefined", tradeContextOf(null) === undefined);

  console.log("\nAGENT_API_KEY 미설정(로컬) 시");
  // identify() 는 호출 시점에 env 를 읽으므로 재import 가 필요 없다
  const saved = process.env.AGENT_API_KEY;
  process.env.AGENT_API_KEY = "";
  t("로컬은 개방(operator)", identify(req())?.scope === "operator");
  t("로컬이어도 유저 키는 유저로 인식", identify(req({ authorization: `Bearer ${ALICE_KEY}` }))?.userId === "alice");
  process.env.AGENT_API_KEY = saved;
  t("복구 후 다시 토큰 필수", identify(req()) === null);

  // ── 실제 HTTP 검증 ─────────────────────────────────────
  console.log("\n실제 서버로 확인");
  const env = { ...process.env, AGENT_API_KEY: OP_KEY, USER_API_KEYS: `alice:${ALICE_KEY},bob:${BOB_KEY}`, HL_MODE: "paper" };
  const srv = spawn("npx", ["next", "dev", "-p", String(PORT)], { env, stdio: "ignore", detached: true });
  const cleanup = () => { try { process.kill(-srv.pid!, "SIGKILL"); } catch { /* 종료됨 */ } };
  process.on("exit", cleanup);

  try {
    const base = `http://127.0.0.1:${PORT}/api/v1`;
    if (!await waitReady(`${base}/perps`)) { console.log("\nAUTH FAIL — 서버 미기동"); cleanup(); process.exit(1); }

    const get = (p: string, h: Record<string, string> = {}) => fetch(`${base}${p}`, { headers: h });
    t("토큰 없이 → 401", (await get("/perps")).status === 401);
    t("틀린 토큰 → 401", (await get("/perps", { authorization: "Bearer wrong" })).status === 401);
    t("X-User-Id 만 보내면 → 401", (await get("/perps", { "x-user-id": "alice" })).status === 401);
    t("운영자 키 → 200", (await get("/perps", { authorization: `Bearer ${OP_KEY}` })).status === 200);
    t("유저 키 → 200", (await get("/perps", { authorization: `Bearer ${ALICE_KEY}` })).status === 200);

    // 미등록 유저로 거래 시도 → 유저 컨텍스트가 실제로 적용되는지
    const openRes = await fetch(`${base}/perp`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${ALICE_KEY}` },
      body: JSON.stringify({ coin: "BTC", direction: "long", marginUsdc: 20, leverage: 1 }),
    });
    const openBody = await openRes.text();
    t("유저 키로 거래 시 유저 컨텍스트가 실제로 붙음", openRes.status < 500, `HTTP ${openRes.status}`);
    t("응답에 다른 유저 정보가 새지 않음", !openBody.includes("bob"));

    console.log(fail === 0 ? "\nAUTH OK — 헤더 위조 불가" : `\nAUTH FAIL — ${fail}건`);
  } finally { cleanup(); }
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error("AUTH FAIL —", e instanceof Error ? e.message : e); process.exit(1); });
