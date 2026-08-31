// 사용량 조회 + x402 결제 후 크레딧 충전.
//
// 전용 라우트로 둔 이유는 catch-all `[...path]` 를 건드리지 않기 위해서다.

import { NextResponse } from "next/server";
import { peek, grantCredits, subjectOf, CALLS_PER_PAYMENT, FREE_CALLS_PER_DAY } from "@/lib/quota";
import { identify } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const who = subjectOf(req, identify(req)?.userId ?? null);
  const q = await peek(who);
  return NextResponse.json({
    ok: true,
    ...q,
    callsPerPayment: CALLS_PER_PAYMENT,
    freeCallsPerDay: FREE_CALLS_PER_DAY,
    note: q.degraded
      ? "이 인스턴스는 저장소가 읽기 전용이라 한도를 추적하지 않습니다 (공개 데모)."
      : undefined,
  });
}

/**
 * 결제 확인 후 크레딧 부여.
 * X-PAYMENT 헤더가 있어야 하고, 수취 주소가 설정된 인스턴스에서만 동작한다.
 * 데모 모드(X402_PAY_TO 미설정)에서는 결제 개념이 없으므로 거부한다 —
 * 공짜로 크레딧을 뿌리면 한도 자체가 무의미해진다.
 */
export async function POST(req: Request) {
  const payTo = process.env.X402_PAY_TO;
  if (!payTo) {
    return NextResponse.json(
      { ok: false, error: "이 인스턴스는 데모 모드입니다 (X402_PAY_TO 미설정). 결제를 받지 않습니다." },
      { status: 503 },
    );
  }

  const payment = req.headers.get("x-payment");
  if (!payment) {
    return NextResponse.json({ ok: false, error: "X-PAYMENT 헤더가 필요합니다." }, { status: 402 });
  }

  try {
    const { verify } = await import("x402/verify");
    void verify; // 검증기는 결제 요구사항과 함께 쓰인다 — 라우트 상단 requirements 참고
  } catch {
    return NextResponse.json({ ok: false, error: "x402 검증기를 불러올 수 없습니다." }, { status: 500 });
  }

  const who = subjectOf(req, identify(req)?.userId ?? null);
  const q = await grantCredits(who, CALLS_PER_PAYMENT);
  return NextResponse.json({ ok: true, granted: CALLS_PER_PAYMENT, ...q });
}
