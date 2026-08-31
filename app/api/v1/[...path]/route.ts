// Agent REST API — LLM 없이 툴 로직을 직접 호출 (Bankr의 API 레이어에 해당)
// AGENT_API_KEY 설정 시 Bearer 인증 요구

import { NextResponse } from "next/server";
import { getUsdPrice } from "@/lib/price";
import { portfolio, swap } from "@/lib/ledger";
import { closePerp, getPerpMid, getPerpPositions, openPerp } from "@/lib/perps";
import { buyToken, getLaunchpad, launchToken, sellToken } from "@/lib/launchpad";
import { onchainBalance } from "@/lib/wallet";

interface Body {
  from?: string;
  to?: string;
  amount?: number;
  coin?: string;
  direction?: "long" | "short";
  marginUsdc?: number;
  leverage?: number;
  name?: string;
  symbol?: string;
  usdcAmount?: number;
  tokenAmount?: number;
  address?: string;
}

export const runtime = "nodejs";

function authorized(req: Request): boolean {
  const key = process.env.AGENT_API_KEY;
  if (!key) return true; // 로컬 개발 기본: 개방
  return req.headers.get("authorization") === `Bearer ${key}`;
}

function unauthorized() {
  return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
}

async function run(fn: () => Promise<unknown> | unknown) {
  try {
    return NextResponse.json(await fn());
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}

export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  if (!authorized(req)) return unauthorized();
  const { path } = await ctx.params;
  const url = new URL(req.url);
  const q = (k: string) => url.searchParams.get(k) ?? undefined;

  switch (path[0]) {
    case "price":
      return run(async () => ({ ok: true, symbol: q("symbol"), usdPrice: await getUsdPrice(q("symbol") ?? "") }));
    case "portfolio":
      return run(() => portfolio());
    case "perps":
      return run(() => getPerpPositions());
    case "perp-price":
      return run(async () => ({ ok: true, coin: q("coin")?.toUpperCase(), mid: await getPerpMid(q("coin") ?? "" ) }));
    case "launchpad":
      return run(() => getLaunchpad());
    case "trades":
      return run(() => import("@/lib/journal").then((j) => j.getTrades()));
    case "revenue":
      return run(() => import("@/lib/revenue").then((r) => r.revenueSummary()));
    case "bal":
      return run(() => onchainBalance(q("address")));
    default:
      return NextResponse.json({ ok: false, error: "unknown path" }, { status: 404 });
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  if (!authorized(req)) return unauthorized();
  const { path } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Body;

  switch (path[0]) {
    case "swap":
      return run(() => swap(body.from ?? "", body.to ?? "", Number(body.amount)));
    case "perp":
      return run(() => openPerp(body.coin ?? "", body.direction ?? "long", Number(body.marginUsdc), Number(body.leverage ?? 1)));
    case "close":
      return run(() => closePerp(body.coin ?? ""));
    case "launch":
      return run(() => launchToken(body.name ?? "", body.symbol ?? ""));
    case "buy":
      return run(() => buyToken(body.symbol ?? "", Number(body.usdcAmount)));
    case "sell":
      return run(() => sellToken(body.symbol ?? "", Number(body.tokenAmount)));
    case "bal":
      return run(() => onchainBalance(body.address));
    default:
      return NextResponse.json({ ok: false, error: "unknown path" }, { status: 404 });
  }
}
