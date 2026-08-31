// x402 유료 엔드포인트 — 결제 없으면 402 페이월, 결제/데모 모드에서만 툴 실행
// X402_PAY_TO 미설정 = 데모 모드(무료 실행). 설정하면 base-sepolia exact 스킴으로 검증·정산

import { NextResponse } from "next/server";
import { getUsdPrice } from "@/lib/price";
import { portfolio } from "@/lib/ledger";

export const runtime = "nodejs";

const USDC_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
const MAX_AMOUNT = "10000"; // 0.01 USDC (6 decimals)

const TOOLS = {
  price: async (params: URLSearchParams) => ({ ok: true, symbol: params.get("symbol"), usdPrice: await getUsdPrice(params.get("symbol") ?? "") }),
  portfolio: async () => portfolio(),
} as const;

type ToolName = keyof typeof TOOLS;

function requirements(resource: string, payTo: string) {
  return {
    scheme: "exact",
    network: "base-sepolia",
    maxAmountRequired: MAX_AMOUNT,
    resource,
    description: "Agent Terminal paid tool call",
    mimeType: "application/json",
    payTo,
    maxTimeoutSeconds: 60,
    asset: USDC_BASE_SEPOLIA,
    extra: { name: "USDC", version: "2" },
  };
}

async function payment402(resource: string) {
  const { verify } = await import("x402/verify");
  return NextResponse.json(
    {
      x402Version: 1,
      error: "X-PAYMENT header is required",
      accepts: [requirements(resource, process.env.X402_PAY_TO ?? "")],
      verifyAvailable: typeof verify === "function",
    },
    { status: 402 }
  );
}

async function handle(req: Request) {
  const url = new URL(req.url);
  const toolName = (url.searchParams.get("tool") ?? "price") as ToolName;
  if (!(toolName in TOOLS)) {
    return NextResponse.json({ ok: false, error: `unknown tool: ${toolName}`, available: Object.keys(TOOLS) }, { status: 404 });
  }

  const resource = `${url.origin}/api/x402?tool=${toolName}`;
  const paymentHeader = req.headers.get("x-payment");

  // 데모 모드: 수취 주소 미설정 → 무료 실행
  if (!process.env.X402_PAY_TO) {
    try {
      const result = await TOOLS[toolName](url.searchParams);
      return NextResponse.json({ ...result, mode: "demo", note: "X402_PAY_TO 설정 시 유료 전환" });
    } catch (e) {
      return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 400 });
    }
  }

  if (!paymentHeader) return payment402(resource);

  // 결제 검증 + 정산 (base-sepolia exact)
  try {
    const { verify, settle } = await import("x402/verify");
    const decoded = JSON.parse(Buffer.from(paymentHeader, "base64").toString("utf8")) as Record<string, unknown>;
    const payload = { x402Version: 1, scheme: "exact", network: "base-sepolia", payload: decoded };
    const reqs = requirements(resource, process.env.X402_PAY_TO);

    const verification = await verify(payload as never, reqs as never);
    if (!verification.isValid) {
      return NextResponse.json({ x402Version: 1, error: verification.invalidReason }, { status: 402 });
    }
    const settlement = await settle(payload as never, reqs as never);
    if (!settlement.success) {
      return NextResponse.json({ x402Version: 1, error: settlement.errorReason }, { status: 402 });
    }

    const result = await TOOLS[toolName](url.searchParams);
    return NextResponse.json({ ...result, mode: "paid", payer: verification.payer, transaction: settlement.transaction });
  } catch (e) {
    return NextResponse.json(
      { x402Version: 1, error: `payment verification failed: ${e instanceof Error ? e.message : String(e)}` },
      { status: 402 }
    );
  }
}

export const GET = handle;
export const POST = handle;
