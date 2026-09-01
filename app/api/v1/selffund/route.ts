// 자가자금 루프 상태 조회 / 정산.
//
// GET  — 현재 상태 (전환하지 않음)
// POST — 미정산 수수료를 LLM 크레딧으로 전환 (멱등)
//
// 전용 라우트로 둔 이유는 catch-all `[...path]` 를 건드리지 않기 위해서다.

import { NextResponse } from "next/server";
import { peekSelfFund, settleSelfFund, volumeNeededForCalls } from "@/lib/selffund";
import { identify } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (identify(req) === null) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  try {
    const s = await peekSelfFund();
    return NextResponse.json({
      ok: true,
      ...s,
      // 설명용: 하루 1,000회를 돌리려면 거래량이 얼마나 필요한가
      volumeForDailyCalls: { calls: 1000, usdVolume: volumeNeededForCalls(1000) },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    );
  }
}

export async function POST(req: Request) {
  // identify() 는 AGENT_API_KEY 가 없으면 로컬 개발로 보고 익명을 운영자로 통과시킨다.
  // 조회 라우트에는 맞는 기본값이지만, 여기는 원장에 쓰는 경로다.
  // 키가 설정돼 있지 않으면 "운영자가 없는 것"으로 보고 아무도 정산할 수 없게 한다.
  if (!process.env.AGENT_API_KEY) {
    return NextResponse.json(
      { ok: false, error: "settlement disabled: AGENT_API_KEY is not configured" },
      { status: 503 },
    );
  }

  // 정산은 운영자만. 아무나 부르면 크레딧 풀을 임의로 움직일 수 있다.
  const id = identify(req);
  if (id === null || id.scope !== "operator") {
    return NextResponse.json({ ok: false, error: "operator only" }, { status: 403 });
  }
  try {
    const r = await settleSelfFund();
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 400 },
    );
  }
}
