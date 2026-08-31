// 공개 지표. 인증 없이 열어둔다 — Bankr 처럼 숫자가 곧 마케팅이라서다.
// 대신 개인 데이터는 한 줄도 나가지 않는다 (집계와 자산 수만).

import { NextResponse } from "next/server";
import { publicMetrics } from "@/lib/metrics";

export const runtime = "nodejs";
export const revalidate = 60;

export async function GET() {
  try {
    return NextResponse.json({ ok: true, ...(await publicMetrics()) });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
