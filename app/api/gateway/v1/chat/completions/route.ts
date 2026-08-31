// LLM 게이트웨이 — OpenAI 호환 프록시 + 크레딧 과금 + 사용량 기록
// 인증(GATEWAY_API_KEYS) → 크레딧 잔액 검사 → 프록시 → 토큰량 과금 → 사용량 적산

import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

const USAGE_PATH = path.join(process.cwd(), "data", "usage.json");
const CREDITS_PATH = path.join(process.cwd(), "data", "credits.json");

interface UsageRecord {
  ts: string;
  keyPrefix: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
}

interface Credit {
  balanceUsdc: number;
  spentUsdc: number;
  calls: number;
}

async function readJson<T>(p: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(p, "utf8")) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(p: string, v: unknown): Promise<void> {
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(v, null, 2) + "\n", "utf8");
}

const per1k = (env: string | undefined, fallback: number) => {
  const n = Number(env);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const key = auth.replace(/^Bearer /, "");
  const keys = (process.env.GATEWAY_API_KEYS ?? "").split(",").map((k) => k.trim()).filter(Boolean);
  if (keys.length === 0 || !keys.includes(key)) {
    return NextResponse.json(
      { error: { message: "invalid gateway key. Set GATEWAY_API_KEYS in .env.local", type: "auth_error" } },
      { status: 401 }
    );
  }

  // 크레딧 페이월 — 잔액이 없으면 업스트림 호출 전에 402
  const credits = await readJson<Record<string, Credit>>(CREDITS_PATH, {});
  const credit = credits[key];
  if (!credit || credit.balanceUsdc <= 0) {
    return NextResponse.json(
      {
        error: {
          message: "no credits. POST /api/gateway/topup {\"key\":\"<your key>\"} (demo grants 5 USDC). In production this is an x402 payment.",
          type: "insufficient_credits",
        },
      },
      { status: 402 }
    );
  }

  const body = (await req.json().catch(() => null)) as { model?: string } | null;
  if (!body?.model) {
    return NextResponse.json({ error: { message: "model field required", type: "invalid_request_error" } }, { status: 400 });
  }

  const upstreamBase = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const upstream = await fetch(`${upstreamBase}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify(body),
  });
  const json = (await upstream.json()) as {
    usage?: { prompt_tokens?: number; completion_tokens?: number };
    error?: unknown;
  };

  if (upstream.ok && json.usage) {
    const promptTokens = json.usage.prompt_tokens ?? 0;
    const completionTokens = json.usage.completion_tokens ?? 0;

    const pricePrompt = per1k(process.env.GATEWAY_PRICE_PROMPT_1K, 0.001);
    const priceCompletion = per1k(process.env.GATEWAY_PRICE_COMPLETION_1K, 0.004);
    const cost = (promptTokens / 1000) * pricePrompt + (completionTokens / 1000) * priceCompletion;

    credits[key] = {
      balanceUsdc: (credits[key]?.balanceUsdc ?? 0) - cost,
      spentUsdc: (credits[key]?.spentUsdc ?? 0) + cost,
      calls: (credits[key]?.calls ?? 0) + 1,
    };
    await writeJson(CREDITS_PATH, credits);
    await (await import("@/lib/revenue")).recordRevenue("gateway", cost, body.model);

    const usage = await readJson<UsageRecord[]>(USAGE_PATH, []);
    usage.push({
      ts: new Date().toISOString(),
      keyPrefix: key.slice(0, 4),
      model: body.model,
      promptTokens,
      completionTokens,
    });
    await writeJson(USAGE_PATH, usage);
  }

  return NextResponse.json(json, { status: upstream.status });
}
