// 게이트웨이 크레딧 탑업 (데모) — 실서비스에서는 x402 결제가 이 자리를 대신한다
import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

const CREDITS_PATH = path.join(process.cwd(), "data", "credits.json");

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { key?: string };
  const key = body.key?.trim() ?? "";
  const keys = (process.env.GATEWAY_API_KEYS ?? "").split(",").map((k) => k.trim()).filter(Boolean);
  if (!keys.includes(key)) {
    return NextResponse.json({ ok: false, error: "unknown gateway key" }, { status: 401 });
  }

  const amount = Number(process.env.GATEWAY_DEMO_TOPUP ?? "5");
  let credits: Record<string, { balanceUsdc: number; spentUsdc: number; calls: number }> = {};
  try {
    credits = JSON.parse(await fs.readFile(CREDITS_PATH, "utf8"));
  } catch {
    credits = {};
  }
  credits[key] = {
    balanceUsdc: (credits[key]?.balanceUsdc ?? 0) + amount,
    spentUsdc: credits[key]?.spentUsdc ?? 0,
    calls: credits[key]?.calls ?? 0,
  };
  await fs.mkdir(path.dirname(CREDITS_PATH), { recursive: true });
  await fs.writeFile(CREDITS_PATH, JSON.stringify(credits, null, 2) + "\n", "utf8");

  return NextResponse.json({
    ok: true,
    key: key.slice(0, 4) + "…",
    addedUsdc: amount,
    balanceUsdc: credits[key].balanceUsdc,
    note: "데모 탑업 — 실서비스에서는 X402_PAY_TO 설정 후 x402 USDC 결제로 대체",
  });
}
