// 최종 E2E — LLM(GLM) + 툴 루프로 MVP 성공 기준 3개 검증 (봇과 같은 코어)
// 실행: npm run test:e2e

import "../lib/env";
import type { ModelMessage } from "ai";
import { runAgent } from "../bot/agent";
import { getBalances } from "../lib/ledger";

async function main() {
  const history: ModelMessage[] = [];
  const ask = async (text: string) => {
    console.log(`\n🔎 you> ${text}`);
    history.push({ role: "user", content: text });
    const answer = await runAgent(history);
    history.push({ role: "assistant", content: answer });
    console.log(`🤖 agent> ${answer}`);
    return answer;
  };

  console.log("=== 기준 1: 시세 조회 ===");
  const a1 = await ask("ETH 가격 알려줘");
  if (!/\$|달러|USD|\d/.test(a1)) throw new Error("가격 응답 아님");

  console.log("\n=== 기준 2: 스왑 실행 ===");
  const usdcBefore = (await getBalances())["usdc"] ?? 0;
  const a2 = await ask("100 USDC를 ETH로 바꿔줘");
  const usdcAfter = (await getBalances())["usdc"] ?? 0;
  if (!(usdcBefore - usdcAfter >= 99.9)) throw new Error(`장부 미반영: ${usdcBefore} → ${usdcAfter}`);
  if (!/paper|페이퍼/i.test(a2)) console.log("⚠️ 응답에 페이퍼 표기 없음");

  console.log("\n=== 기준 3: 맥락 유지 재지시 ===");
  const a3 = await ask("그거 다시 팔아줘");
  const usdcFinal = (await getBalances())["usdc"] ?? 0;
  if (!(usdcFinal > usdcAfter)) throw new Error("재판매 미실행: USDC 복귀 없음");

  console.log("\n🎉 E2E 3개 기준 통과 — usdc:", usdcBefore, "→", usdcAfter, "→", usdcFinal);
}

main().catch((e) => {
  console.error("\n❌ E2E 실패:", e instanceof Error ? e.message : e);
  process.exit(1);
});
