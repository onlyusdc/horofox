// G1/G2 — 자가자금 루프. 돈이 크레딧으로 바뀌는 경로라 이중 지급이 가장 위험하다.
import "../lib/env";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";

const API = process.argv.includes("--api");
const PORT = 3475;

async function waitReady(url: string, ms = 180_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { if ((await fetch(url)).status < 500) return true; } catch { /* 대기 */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function unit() {
  let fail = 0;
  const t = (n: string, ok: boolean, x = "") => { if (!ok) fail++; console.log(`  ${ok ? "✓" : "✗"} ${n}${x ? "  " + x : ""}`); };

  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "sf-"));
  const orig = process.cwd();
  process.chdir(tmp);
  await fs.mkdir("data", { recursive: true });

  process.env.USER_ENCRYPTION_KEY = "f".repeat(64);
  process.env.SELFFUND_USD_PER_CALL = "0.001";
  process.env.SELFFUND_CONVERT_RATIO = "0.5";
  process.env.FREE_CALLS_PER_DAY = "0";

  try {
    const SF = await import("../lib/selffund");
    const Q = await import("../lib/quota");

    console.log(`단가 $${SF.USD_PER_CALL}/call · 전환비율 ${SF.CONVERT_RATIO} · 풀 ${SF.POOL_SUBJECT}`);

    console.log("\n환산 (순수 계산)");
    t("$10 수수료 × 50% ÷ $0.001 = 5,000회", SF.callsFor(10) === 5000);
    t("$0 이면 0회", SF.callsFor(0) === 0);
    t("음수도 0회", SF.callsFor(-5) === 0);
    t("소수점은 버린다 (없는 크레딧 안 만듦)", SF.callsFor(0.0015) === 0, `$0.0015 → ${SF.callsFor(0.0015)}회`);
    t("비율 0 거부", (() => { try { SF.callsFor(10, 0); return false; } catch { return true; } })());
    t("비율 1 초과 거부", (() => { try { SF.callsFor(10, 1.5); return false; } catch { return true; } })());
    t("단가 0 거부", (() => { try { SF.callsFor(10, 0.5, 0); return false; } catch { return true; } })());

    console.log("\n역산 (설명용)");
    // 1,000회 = $1 원가 ÷ 0.5 = $2 수수료 ÷ 0.1% = $2,000 거래량
    t("1,000회를 벌려면 거래량 $2,000", SF.volumeNeededForCalls(1000) === 2000, `$${SF.volumeNeededForCalls(1000)}`);
    t("0회는 0", SF.volumeNeededForCalls(0) === 0);

    console.log("\n멱등성 — 같은 수수료를 두 번 세지 않는가 (가장 위험한 지점)");
    // 수수료 조회기를 고정값으로 주입해 결정론적으로 만든다 (온체인 호출 없음)
    let fakeEarned = 10;
    const rev = async () => ({ builder: "0xtest", cumulativeUsd: fakeEarned, feePercent: 0.1, configured: true });

    const s0 = await SF.peekSelfFund(rev);
    t("초기 미정산 = 온체인 수취액", s0.pendingUsd === 10, `$${s0.pendingUsd}`);
    t("전환 가능 5,000회", s0.convertibleCalls === 5000);

    const r1 = await SF.settleSelfFund(rev);
    t("1차 정산 5,000회 부여", r1.granted === 5000, `granted=${r1.granted}`);
    t("정산 후 미정산 0", r1.pendingUsd === 0, `$${r1.pendingUsd}`);

    const r2 = await SF.settleSelfFund(rev);
    t("2차 정산은 0회 (이중 지급 없음)", r2.granted === 0, `granted=${r2.granted}`);

    const q1 = await Q.peek(SF.POOL_SUBJECT);
    t("크레딧이 정확히 5,000 (중복 아님)", q1.credits === 5000, `credits=${q1.credits}`);

    console.log("\n동시 정산 — 버튼 두 번, 크론과 수동이 겹칠 때");
    // 직렬화 전에는 두 호출이 같은 미정산액을 보고 각자 5,000회를 부여했다.
    fakeEarned = 20; // 미정산 $10 (이미 $10 정산됨)
    const [c1, c2] = await Promise.all([SF.settleSelfFund(rev), SF.settleSelfFund(rev)]);
    t("동시 호출의 합이 1회분과 같다", c1.granted + c2.granted === 5000, `${c1.granted}+${c2.granted}`);
    const qr = await Q.peek(SF.POOL_SUBJECT);
    t("크레딧 10,000 (이중 지급 아님)", qr.credits === 10000, `credits=${qr.credits}`);
    const after = await SF.peekSelfFund(rev);
    t("정산 후 미정산 0", after.pendingUsd === 0, `$${after.pendingUsd}`);

    console.log("\n수수료가 더 들어오면");
    fakeEarned = 35; // +$15
    const s2 = await SF.peekSelfFund(rev);
    t("증가분만 미정산으로 잡힘", Math.abs(s2.pendingUsd - 15) < 1e-9, `$${s2.pendingUsd}`);
    const r3 = await SF.settleSelfFund(rev);
    t("증가분만큼만 추가 부여 (7,500회)", r3.granted === 7500, `granted=${r3.granted}`);
    const q2 = await Q.peek(SF.POOL_SUBJECT);
    t("누적 크레딧 17,500 (5,000+5,000+7,500)", q2.credits === 17500, `credits=${q2.credits}`);

    console.log("\n온체인 값이 줄어들면 (주소 교체 등)");
    fakeEarned = 5; // 정산액보다 작아짐
    const s3 = await SF.peekSelfFund(rev);
    t("음수 미정산을 만들지 않음", s3.pendingUsd === 0, `$${s3.pendingUsd}`);
    const r4 = await SF.settleSelfFund(rev);
    t("환수하거나 마이너스 부여하지 않음", r4.granted === 0);

    console.log("\n빌더 주소 미설정");
    const revNone = async () => ({ builder: "", cumulativeUsd: 0, feePercent: 0.1, configured: false });
    const s4 = await SF.peekSelfFund(revNone);
    t("configured=false 로 알림", s4.builderConfigured === false);
    t("이유를 문구로 설명", (s4.note ?? "").includes("HL_BUILDER_ADDRESS"));

    console.log(fail === 0 ? "\nSELFFUND OK — 이중 지급 없음" : `\nSELFFUND FAIL — ${fail}건`);
  } finally {
    process.chdir(orig);
    await fs.rm(tmp, { recursive: true, force: true });
  }
  process.exit(fail === 0 ? 0 : 1);
}

async function api() {
  let fail = 0;
  const t = (n: string, ok: boolean, x = "") => { if (!ok) fail++; console.log(`  ${ok ? "✓" : "✗"} ${n}${x ? "  " + x : ""}`); };

  const OP = "op-key-selffund";
  const USER = "u-key-selffund";
  const env = { ...process.env, AGENT_API_KEY: OP, USER_API_KEYS: `alice:${USER}`, HL_MODE: "paper" };
  const srv = spawn("npx", ["next", "dev", "-p", String(PORT)], { env, stdio: "ignore", detached: true });
  const cleanup = () => { try { process.kill(-srv.pid!, "SIGKILL"); } catch { /* 종료됨 */ } };
  process.on("exit", cleanup);

  try {
    const base = `http://127.0.0.1:${PORT}/api/v1/selffund`;
    if (!await waitReady(base)) { console.log("\nSELFFUND-API FAIL — 서버 미기동"); cleanup(); process.exit(1); }

    console.log("인증");
    t("토큰 없이 GET → 401", (await fetch(base)).status === 401);
    t("유저 키로 GET → 200", (await fetch(base, { headers: { authorization: `Bearer ${USER}` } })).status === 200);

    console.log("\n정산 권한 — 아무나 크레딧 풀을 움직이면 안 된다");
    t("유저 키로 POST → 403", (await fetch(base, { method: "POST", headers: { authorization: `Bearer ${USER}` } })).status === 403);
    t("토큰 없이 POST → 403", (await fetch(base, { method: "POST" })).status === 403);
    const opPost = await fetch(base, { method: "POST", headers: { authorization: `Bearer ${OP}` } });
    t("운영자 키로 POST → 200", opPost.status === 200, `HTTP ${opPost.status}`);

    console.log("\n응답 형태");
    const body = await (await fetch(base, { headers: { authorization: `Bearer ${OP}` } })).json() as Record<string, unknown>;
    for (const k of ["earnedUsd", "settledUsd", "pendingUsd", "convertibleCalls", "grantedCalls", "ratio", "usdPerCall", "builderConfigured"]) {
      t(`${k} 노출`, k in body);
    }
    t("설명용 역산 포함", typeof (body.volumeForDailyCalls as { usdVolume?: number })?.usdVolume === "number");
    t("개인키·시크릿 없음", !/0x[0-9a-fA-F]{64}|sk-[A-Za-z0-9]{20,}/.test(JSON.stringify(body)));

    console.log(fail === 0 ? "\nSELFFUND-API OK" : `\nSELFFUND-API FAIL — ${fail}건`);
  } finally { cleanup(); }
  process.exit(fail === 0 ? 0 : 1);
}

(API ? api() : unit()).catch((e) => { console.error("SELFFUND FAIL —", e instanceof Error ? e.message : e); process.exit(1); });
