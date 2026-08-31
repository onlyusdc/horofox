// 게이트웨이 사용량 조회 — GATEWAY_API_KEYS 인증 (과금 가시성)
import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

const USAGE_PATH = path.join(process.cwd(), "data", "usage.json");

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const keys = (process.env.GATEWAY_API_KEYS ?? "").split(",").map((k) => k.trim()).filter(Boolean);
  if (keys.length === 0 || !keys.includes(auth.replace(/^Bearer /, ""))) {
    return NextResponse.json({ ok: false, error: "invalid gateway key" }, { status: 401 });
  }

  let records: { ts: string; keyPrefix: string; model: string; promptTokens: number; completionTokens: number }[] = [];
  try {
    records = JSON.parse(await fs.readFile(USAGE_PATH, "utf8"));
  } catch {
    records = [];
  }
  const totalPrompt = records.reduce((s, r) => s + r.promptTokens, 0);
  const totalCompletion = records.reduce((s, r) => s + r.completionTokens, 0);
  return NextResponse.json({
    ok: true,
    totalCalls: records.length,
    totalPromptTokens: totalPrompt,
    totalCompletionTokens: totalCompletion,
    records: records.slice(-50),
  });
}
