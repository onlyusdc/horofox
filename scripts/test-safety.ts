// G8 — 안전장치. 여기서 못 막으면 유저 돈이 나간다.
import "../lib/env";

const TB = "0x1111111111111111111111111111111111111111";
process.env.HL_BUILDER_ADDRESS = TB;

async function main() {
  const { assertLeverage, assertMinNotional, assertBuilderEligible, TradeError, resolveAsset } = await import("../lib/hl/trade");
  const { LEVERAGE_CAP, MIN_ORDER_USD, BUILDER_MIN_PERP_ACCOUNT_USDC } = await import("../lib/hl/config");
  const { openPerp } = await import("../lib/perps");

  let fail = 0;
  const t = (n: string, ok: boolean, extra = "") => { if (!ok) fail++; console.log(`  ${ok ? "✓" : "✗"} ${n}${extra ? "  " + extra : ""}`); };
  const rejects = (fn: () => unknown) => { try { fn(); return false; } catch { return true; } };

  console.log("레버리지 상한");
  t("자산 상한 이내 통과", !rejects(() => assertLeverage(10, 40)));
  t("자산 상한 초과 거부", rejects(() => assertLeverage(50, 40)));
  t(`우리 천장 ${LEVERAGE_CAP}배 초과 거부 (자산이 허용해도)`, rejects(() => assertLeverage(LEVERAGE_CAP + 1, 40)));
  t("1배 미만 거부", rejects(() => assertLeverage(0.5, 40)));
  t("NaN 거부", rejects(() => assertLeverage(NaN, 40)));

  console.log("\n최소 주문액");
  t(`$${MIN_ORDER_USD} 이상 통과`, !rejects(() => assertMinNotional(MIN_ORDER_USD)));
  t("미만 거부 (HL 왕복 실패를 미리 차단)", rejects(() => assertMinNotional(MIN_ORDER_USD - 0.01)));

  console.log("\n빌더 자격 — 미달이면 아무도 거래 못 한다");
  t(`퍼프 계정 $${BUILDER_MIN_PERP_ACCOUNT_USDC} 이상 통과`, !rejects(() => assertBuilderEligible(BUILDER_MIN_PERP_ACCOUNT_USDC)));
  t("미달 거부", rejects(() => assertBuilderEligible(99)));

  console.log("\n없는 심볼은 페이퍼에서도 거부 (유령 포지션 방지)");
  const ghost = await openPerp("NOTACOIN", "long", 100, 5);
  t("존재하지 않는 심볼 거부", ghost.ok === false, "ok" in ghost && !ghost.ok ? ghost.error.slice(0, 50) : "");

  console.log("\n입력 검증");
  const neg = await openPerp("BTC", "long", -100, 5);
  t("음수 증거금 거부", neg.ok === false);
  const over = await openPerp("BTC", "long", 100, LEVERAGE_CAP + 10);
  t(`레버리지 ${LEVERAGE_CAP + 10}배 거부`, over.ok === false);

  console.log("\n출금 경로 부재 — 코드에 존재하지 않아야 한다");
  const fs = await import("node:fs/promises");
  const files = ["lib/perps.ts", "lib/hl/trade.ts", "lib/hl/core.ts"];
  let withdrawHits = 0;
  for (const f of files) {
    const src = await fs.readFile(f, "utf8");
    if (/withdraw3|usdSend|spotSend|usdClassTransfer|\.withdraw\(/.test(src)) { withdrawHits++; console.log(`    ✗ ${f} 에 출금 호출 발견`); }
  }
  t("거래 경로에 출금 API 호출 0건", withdrawHits === 0);

  console.log("\nTradeError 가 정상 동작", );
  t("TradeError 는 Error 하위", new TradeError("x") instanceof Error);
  t("resolveAsset 은 없는 심볼에 TradeError", await resolveAsset("NOPE").then(() => false).catch((e) => e instanceof TradeError));

  console.log(fail === 0 ? "\nSAFETY OK" : `\nSAFETY FAIL — ${fail}건`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error("SAFETY FAIL —", e instanceof Error ? e.message : e); process.exit(1); });
