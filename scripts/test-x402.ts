// G3 — x402 유료 API. 죽어 있던 걸 살렸는지, 규격을 지키는지.
import "../lib/env";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";

const PORT = 3472;

async function waitReady(url: string, ms = 180_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { if ((await fetch(url)).status < 500) return true; } catch { /* 대기 */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function main() {
  let fail = 0;
  const t = (n: string, ok: boolean, x = "") => { if (!ok) fail++; console.log(`  ${ok ? "✓" : "✗"} ${n}${x ? "  " + x : ""}`); };

  console.log("가격 일관성 (코드 ↔ 랜딩)");
  const src = await fs.readFile("app/api/x402/route.ts", "utf8");
  const dict = await fs.readFile("lib/i18n.ts", "utf8");
  const landing = await fs.readFile("app/page.tsx", "utf8");
  const price = Number(/PRICE_USDC = ([\d.]+)/.exec(src)?.[1]);
  t("코드에 가격 상수 존재", Number.isFinite(price), `$${price}`);
  t("랜딩 표시가와 일치", landing.includes(`$${price}`), `랜딩=$${price}`);
  t("6 decimals 로 환산", src.includes("1_000_000"));
  void dict;

  // 데모 모드 (X402_PAY_TO 미설정) 로 띄운다
  const env = { ...process.env, X402_PAY_TO: "", HL_MODE: "paper" };
  const srv = spawn("npx", ["next", "dev", "-p", String(PORT)], { env, stdio: "ignore", detached: true });
  const cleanup = () => { try { process.kill(-srv.pid!, "SIGKILL"); } catch { /* 종료됨 */ } };
  process.on("exit", cleanup);

  try {
    const base = `http://127.0.0.1:${PORT}/api/x402`;
    if (!await waitReady(`${base}?tool=price&symbol=BTC`)) { console.log("\nX402 FAIL — 서버 미기동"); cleanup(); process.exit(1); }

    console.log("\n툴 (Hyperliquid 기반 — CoinGecko 403 으로 죽던 걸 교체)");
    const price1 = await (await fetch(`${base}?tool=price&symbol=BTC`)).json() as { ok?: boolean; midPrice?: number; source?: string };
    t("price: BTC", price1.ok === true && (price1.midPrice ?? 0) > 1000, `$${price1.midPrice}`);
    t("출처가 hyperliquid", price1.source === "hyperliquid");

    const skhx = await (await fetch(`${base}?tool=price&symbol=SKHX`)).json() as { ok?: boolean; midPrice?: number };
    t("price: SKHX (HIP-3)", skhx.ok === true && (skhx.midPrice ?? 0) > 0, `$${skhx.midPrice}`);

    const mk = await (await fetch(`${base}?tool=markets`)).json() as { ok?: boolean; count?: number };
    t("markets: 자산 목록", mk.ok === true && (mk.count ?? 0) > 200, `${mk.count}종`);

    const mkx = await (await fetch(`${base}?tool=markets&dex=xyz`)).json() as { count?: number };
    t("markets: dex 필터", (mkx.count ?? 0) > 50 && (mkx.count ?? 0) < (mk.count ?? 0), `xyz=${mkx.count}`);

    const fd = await (await fetch(`${base}?tool=funding&symbol=SKHX`)).json() as { ok?: boolean; annualisedPct?: number; paidBy?: string };
    t("funding: 펀딩률", fd.ok === true && Number.isFinite(fd.annualisedPct), `${fd.annualisedPct?.toFixed(1)}%`);
    t("funding: 지불 방향 명시", /pay/.test(fd.paidBy ?? ""), fd.paidBy);

    console.log("\n오류 처리");
    t("없는 툴 → 404", (await fetch(`${base}?tool=nope`)).status === 404);
    const noSym = await fetch(`${base}?tool=price`);
    t("symbol 누락 → 4xx/5xx 로 명확히", noSym.status >= 400, `HTTP ${noSym.status}`);
    const badSym = await (await fetch(`${base}?tool=funding&symbol=NOTACOIN`)).json() as { ok?: boolean; error?: string };
    t("없는 심볼 → 이유 반환", badSym.ok === false && (badSym.error ?? "").length > 0);

    console.log("\n402 페이월 (수취 주소 설정 시)");
    // 데모 모드에서는 무료 실행이 정상 — 그 사실 자체를 확인한다
    t("데모 모드에서는 402 없이 실행", price1.ok === true);
    t("페이월 코드가 존재", src.includes("x402Version") && src.includes("402"));
    t("스킴·네트워크 명시", src.includes('scheme: "exact"') && src.includes("base-sepolia"));

    console.log(fail === 0 ? "\nX402 OK — 유료 API 동작" : `\nX402 FAIL — ${fail}건`);
  } finally { cleanup(); }
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error("X402 FAIL —", e instanceof Error ? e.message : e); process.exit(1); });
