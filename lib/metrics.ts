// 공개 지표.
//
// Bankr 는 터미널 첫 화면에 총거래량 $5.20B, 창작자 수수료 $22.18M 을 띄운다.
// 숫자를 공개하는 건 옳다 — 우리도 한다. 다만 하나를 다르게 한다.
//
// **실거래와 페이퍼를 절대 합산하지 않는다.**
//
// 우리 런치패드와 일부 거래는 아직 페이퍼다. 그걸 온체인 수치와 더해 한 줄로 만들면
// 커 보이는 대신 거짓이 된다. 그래서 이 모듈은 애초에 합계를 낼 수 없는 모양으로 둔다:
// `live` 와 `paper` 는 서로 다른 객체이고, 둘을 더한 필드는 존재하지 않는다.
// 합치고 싶으면 호출부가 직접 더해야 하고, 그건 눈에 띈다.

import { peekSelfFund, type SelfFundState } from "./selffund";
import { measureCoverage, type Coverage } from "./coverage";
import { revenueSummary } from "./revenue";
import { tradeMode } from "./hl/config";
import { getTrades } from "./journal";

/** 온체인에서 확인 가능한 것만. */
export type LiveMetrics = {
  /** 누적 builder 수수료 (USDC). Hyperliquid 가 지급한 실제 금액. */
  builderFeesUsdc: number;
  /** 그중 LLM 크레딧으로 전환한 몫. */
  convertedToCreditsUsd: number;
  /** 전환으로 확보한 추론 호출 수. */
  fundedCalls: number;
  /** 실거래 모드인가. paper 면 아래 수치는 0 이 정상이다. */
  mode: "live" | "paper";
  builderConfigured: boolean;
};

/** 시뮬레이션. 위 수치와 같은 화면에 있어도 같은 단위가 아니다. */
export type PaperMetrics = {
  /** 페이퍼 런치패드 수수료 (USDC 상당, 가상). */
  launchpadFeesUsdc: number;
  /** 페이퍼 스왑 수수료. */
  swapFeesUsdc: number;
  /** 기록된 페이퍼 거래 건수. */
  trades: number;
};

export type PublicMetrics = {
  live: LiveMetrics;
  paper: PaperMetrics;
  coverage: Coverage;
  /** 합산하지 않는다는 사실 자체를 API 응답에 명시한다. */
  disclaimer: "live and paper are never summed";
  measuredAt: string;
};

export async function publicMetrics(): Promise<PublicMetrics> {
  const [sf, coverage, rev, trades] = await Promise.all([
    peekSelfFund().catch((): SelfFundState => ({
      earnedUsd: 0, settledUsd: 0, pendingUsd: 0, convertibleCalls: 0, grantedCalls: 0,
      ratio: 0, usdPerCall: 0, builderConfigured: false, degraded: true,
    })),
    measureCoverage(),
    revenueSummary().catch(() => ({ launchpadFeesUsdc: 0, swapFeesUsdc: 0 })),
    getTrades(1000).catch(() => []),
  ]);

  const r = rev as { launchpadFeesUsdc?: number; swapFeesUsdc?: number };

  return {
    live: {
      builderFeesUsdc: sf.earnedUsd,
      convertedToCreditsUsd: sf.settledUsd,
      fundedCalls: sf.grantedCalls,
      mode: tradeMode(),
      builderConfigured: sf.builderConfigured,
    },
    paper: {
      launchpadFeesUsdc: r.launchpadFeesUsdc ?? 0,
      swapFeesUsdc: r.swapFeesUsdc ?? 0,
      trades: trades.length,
    },
    coverage,
    disclaimer: "live and paper are never summed",
    measuredAt: new Date().toISOString(),
  };
}
