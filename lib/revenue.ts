// 수익 엔진 — 플랫폼 수익 집계 + LLM 비용 추정 + 플라이휠 순수익
// Bankr 모델: 거래 수수료가 컴퓨팅비를 충당한다 → 그 숫자를 만드는 모듈

import fs from "node:fs/promises";
import path from "node:path";

const DATA = path.join(process.cwd(), "data");
const REVENUE_PATH = path.join(DATA, "revenue.json");
const TOKENS_PATH = path.join(DATA, "tokens.json");
const USAGE_PATH = path.join(DATA, "usage.json");

interface RevenueFile {
  swapFeesUsdc: number;
  gatewayRevenueUsdc: number;
  history: { category: string; usdc: number; ts: string; note?: string }[];
}

const emptyRevenue = (): RevenueFile => ({ swapFeesUsdc: 0, gatewayRevenueUsdc: 0, history: [] });

async function readRevenue(): Promise<RevenueFile> {
  try {
    return { ...emptyRevenue(), ...(JSON.parse(await fs.readFile(REVENUE_PATH, "utf8")) as RevenueFile) };
  } catch {
    return emptyRevenue();
  }
}

export async function recordRevenue(category: "swap" | "gateway", usdc: number, note?: string): Promise<void> {
  if (!(usdc > 0)) return;
  const file = await readRevenue();
  if (category === "swap") file.swapFeesUsdc += usdc;
  else file.gatewayRevenueUsdc += usdc;
  file.history.push({ category, usdc, ts: new Date().toISOString(), note });
  file.history = file.history.slice(-100);
  await fs.mkdir(DATA, { recursive: true });
  await fs.writeFile(REVENUE_PATH, JSON.stringify(file, null, 2) + "\n", "utf8");
}

const per1k = (env: string | undefined, fallback: number) => {
  const n = Number(env);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

export async function revenueSummary() {
  const file = await readRevenue();

  // 런치패드 수수료: tokens.json이 source of truth
  let launchpadFeesUsdc = 0;
  try {
    const tokens = (JSON.parse(await fs.readFile(TOKENS_PATH, "utf8")) as { tokens: Record<string, { feesUsdc: number }> }).tokens;
    launchpadFeesUsdc = Object.values(tokens).reduce((s, t) => s + t.feesUsdc, 0);
  } catch {
    /* 토큰 없음 */
  }

  // LLM 비용 추정 (usage.json × 요율)
  const pricePrompt = per1k(process.env.GATEWAY_PRICE_PROMPT_1K, 0.001);
  const priceCompletion = per1k(process.env.GATEWAY_PRICE_COMPLETION_1K, 0.004);
  let promptTokens = 0;
  let completionTokens = 0;
  try {
    const usage = JSON.parse(await fs.readFile(USAGE_PATH, "utf8")) as { promptTokens: number; completionTokens: number }[];
    promptTokens = usage.reduce((s, u) => s + (u.promptTokens || 0), 0);
    completionTokens = usage.reduce((s, u) => s + (u.completionTokens || 0), 0);
  } catch {
    /* 사용량 없음 */
  }
  const llmCostUsdc = (promptTokens / 1000) * pricePrompt + (completionTokens / 1000) * priceCompletion;

  const totalRevenueUsdc = file.swapFeesUsdc + launchpadFeesUsdc + file.gatewayRevenueUsdc;
  return {
    swapFeesUsdc: file.swapFeesUsdc,
    launchpadFeesUsdc,
    gatewayRevenueUsdc: file.gatewayRevenueUsdc,
    totalRevenueUsdc,
    llmUsage: { promptTokens, completionTokens },
    llmCostUsdc,
    netUsdc: totalRevenueUsdc - llmCostUsdc,
    selfSustaining: totalRevenueUsdc >= llmCostUsdc,
    rates: { promptPer1kUsdc: pricePrompt, completionPer1kUsdc: priceCompletion },
  };
}
