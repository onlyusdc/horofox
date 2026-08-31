// Bankr 패리티 기능 통합 테스트 — 네트워크 가능 시 실데이터로 검증
// 실행: npm run test:parity

import { getPerpMid, openPerp, getPerpPositions, closePerp } from "../lib/perps";
import { launchToken, buyToken, sellToken, getLaunchpad, priceOf } from "../lib/launchpad";
import { onchainBalance } from "../lib/wallet";
import { tools } from "../lib/tools";
import { getBalances } from "../lib/ledger";

let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  console.log(`${cond ? "✅" : "❌"} ${name}`, cond ? "" : detail ?? "");
  if (!cond) failed++;
}

// 테스트는 반복 실행 가능해야 한다. 고정 심볼·고정 포지션을 쓰면
// 두 번째 실행부터 "이미 발행됨"·"포지션 이미 있음"으로 깨진다.
const RUN = String(Date.now()).slice(-5);
const SYM = `PT${RUN}`;

async function resetPaperState() {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  // 페이퍼 원장·포지션만 초기화한다. users.json 은 건드리지 않는다.
  for (const [f, empty] of [["perps.json", { positions: [] }], ["tokens.json", { tokens: {} }]] as const) {
    await fs.writeFile(path.join(process.cwd(), "data", f), JSON.stringify(empty, null, 2) + "\n", "utf8").catch(() => {});
  }
}

async function main() {
  await resetPaperState();
  console.log("=== 1. Hyperliquid 실시간 시세 ===");
  try {
    const btc = await getPerpMid("BTC");
    check("BTC mid 실데이터", Number.isFinite(btc) && btc > 0, btc);

    console.log("\n=== 2. 페이퍼 퍼펫 열기/평가/청산 ===");
    const usdcBefore = (await getBalances())["usdc"] ?? 0;
    const open = await openPerp("ETH", "long", 50, 5);
    check("롱 포지션 진입", "ok" in open && open.ok, open);
    const positions = await getPerpPositions();
    check("포지션에 실시간 mark + uPnL", positions.positions.length === 1 && Number.isFinite(positions.positions[0].unrealizedPnlUsd), positions);
    const close = await closePerp("ETH");
    const usdcAfter = (await getBalances())["usdc"] ?? 0;
    check(
      "청산 정산 (증거금±PnL 복귀)",
      "ok" in close && close.ok && Math.abs(usdcAfter - usdcBefore) < 1e-6,
      { close, usdcBefore, usdcAfter }
    );
  } catch (e) {
    failed++;
    console.log("❌ Hyperliquid 구간 네트워크 오류:", e instanceof Error ? e.message : e);
  }

  console.log("\n=== 3. 런치패드: 발행 → 매수 → 매도 → 수수료 ===");
  const launch = await launchToken("Parity Test", SYM);
  check("토큰 발행 (초기가 0.0001)", "ok" in launch && launch.ok && launch.initialPriceUsdc === 0.0001, launch);
  const buy = await buyToken(SYM, 10);
  check("10 USDC 매수 → 토큰 수령 + 가격 상승", "ok" in buy && buy.ok && buy.priceAfterUsdc > 0.0001, buy);
  // 잔고 키는 심볼 소문자다. 심볼을 고유화했으므로 여기도 따라가야 한다.
  const beforeSell = buy.ok && "received" in buy ? (await getBalances())[SYM.toLowerCase()] ?? 0 : 0;
  const sell = await sellToken(SYM, beforeSell);
  check("전량 매도 → USDC 복귀", "ok" in sell && sell.ok, sell);
  const pad = await getLaunchpad();
  const prty = pad.tokens.find((t) => t.symbol === SYM);
  check("1% 수수료 적립됨 (플라이휠)", !!prty && prty.feesUsdc > 0, prty?.feesUsdc);

  console.log("\n=== 4. 온체인 지갑 조회 (Base Sepolia 공개 RPC) ===");
  try {
    const bal = await onchainBalance("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045");
    check("주소 잔액 조회", "ok" in bal && bal.ok && Number.isFinite(bal.ethBalance), bal);
  } catch (e) {
    failed++;
    console.log("❌ RPC 오류:", e instanceof Error ? e.message : e);
  }

  console.log("\n=== 5. 스킬 로드 + 툴 레지스트리 ===");
  check("퍼펫 툴 등록", ["getPerpPrice", "openPerp", "closePerp", "getPerpPositions"].every((k) => k in tools));
  check("런치패드 툴 등록", ["launchToken", "buyToken", "sellToken", "getLaunchpad"].every((k) => k in tools));
  check("스킬(gas) 등록", "getGasPrice" in tools);

  await resetPaperState(); // 다음 실행을 위해 흔적을 지운다
  console.log(failed === 0 ? "\n🎉 패리티 테스트 전체 통과" : `\n💥 ${failed}개 실패`);
  if (failed > 0) process.exit(1);
}

main();
