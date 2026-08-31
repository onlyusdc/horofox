// 현재 거래 모드 — 대시보드가 LIVE/PAPER 배지를 그리는 데 쓴다.
//
// 전용 라우트로 둔 이유: catch-all `[...path]` 를 건드리지 않기 위해서다.
// Next 는 정적 세그먼트를 동적보다 먼저 매칭하므로 이 파일이 우선한다.
//
// **개인키는 절대 내보내지 않는다.** 주소와 상태만 노출한다.

import { NextResponse } from "next/server";
import { perpMode } from "@/lib/perps";
import { BUILDER_ADDRESS, IS_TESTNET, PERP_FEE_PERCENT } from "@/lib/hl/config";
import { authWarning } from "@/lib/auth";
import { isWritable } from "@/lib/storage";

export const runtime = "nodejs";

function authorized(req: Request): boolean {
  const key = process.env.AGENT_API_KEY;
  if (!key) return true; // 로컬 개발 기본: 개방
  return req.headers.get("authorization") === `Bearer ${key}`;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  try {
    const m = perpMode();
    return NextResponse.json({
      ok: true,
      mode: m.mode,
      reason: m.reason,
      trader: m.trader,
      builder: BUILDER_ADDRESS || null,
      feePercent: PERP_FEE_PERCENT,
      network: IS_TESTNET ? "testnet" : "mainnet",
      // 이 인스턴스가 스스로의 상태를 밝힌다 — 숨기면 운영자가 모르고 넘어간다.
      warnings: [authWarning()].filter(Boolean),
      storage: (await isWritable()) ? "writable" : "read-only",
      llm: process.env.OPENAI_API_KEY ? "configured" : "not-configured",
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    );
  }
}
