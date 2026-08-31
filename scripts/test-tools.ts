// 툴 단독 테스트 — LLM 없이 3개 툴의 execute 로직을 직접 실행
// 실행: npm run test:tools

import { tools } from "../lib/tools";
import { resetPaperState } from "./_reset-paper";

async function main() {
  await resetPaperState(); // 반복 실행 가능하게
  console.log("=== 1. getPrice (실데이터) ===");
  const price = await tools.getPrice.execute!({ symbol: "eth" }, { toolCallId: "t1", messages: [] });
  console.log(JSON.stringify(price, null, 2));
  if (!(price as { ok: boolean }).ok) throw new Error("getPrice 실패");

  console.log("\n=== 2. executeSwap (페이퍼 체결) ===");
  const sw = await tools.executeSwap.execute!({ from: "usdc", to: "eth", amount: 100 }, { toolCallId: "t2", messages: [] });
  console.log(JSON.stringify(sw, null, 2));
  if (!(sw as { ok: boolean }).ok) throw new Error("executeSwap 실패");

  console.log("\n=== 2b. 잔고 부족 케이스 ===");
  const poor = await tools.executeSwap.execute!({ from: "eth", to: "usdc", amount: 99999 }, { toolCallId: "t3", messages: [] });
  console.log(JSON.stringify(poor, null, 2));
  if ((poor as { ok: boolean }).ok) throw new Error("잔고 부족이어야 하는데 성공함");

  console.log("\n=== 3. getPortfolio ===");
  const pf = await tools.getPortfolio.execute!({}, { toolCallId: "t4", messages: [] });
  console.log(JSON.stringify(pf, null, 2));

  console.log("\n✅ 툴 3종 모두 통과");
}

main().catch((e) => {
  console.error("\n❌ 실패:", e);
  process.exit(1);
});
