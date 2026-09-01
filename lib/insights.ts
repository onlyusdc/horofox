// 게시할 "실측된 관찰".
//
// 소셜 봇이 하루 몇 번 글을 올리는데, 그 글의 숫자를 지어내면 서비스 전체가 거짓이 된다.
// 그래서 이 모듈은 **Hyperliquid 에서 읽은 값만** 반환하고 문장은 만들지 않는다.
// 문장은 채널 계층이 이 객체의 필드만 보간해서 만든다 — 템플릿이 새 숫자를 발명할 수 없다.
//
// 우리가 이걸 올릴 자격: 데이터가 희귀해서가 아니다 — TradingView 가 2026-07 부터
// HIP3XYZ: 프리픽스로 같은 데이터를 제공한다. 차이는 **읽고 나서 바로 거래까지 간다**는 것이다.
// 차트는 보여주기만 하고, 우리는 같은 대화 안에서 주문에 서명한다.

import * as hl from "@nktkas/hyperliquid";
import { HIP3_DEXES } from "./hl/core";
import { measureCoverage, classify, type Coverage } from "./coverage";
import type { AssetMeta } from "./hl/core";

/** 시간당 펀딩률 → 연율 퍼센트. app/api/x402/route.ts 의 funding 툴과 같은 공식이다. */
export function annualisedPct(hourly: number): number {
  return hourly * 24 * 365 * 100;
}

export type FundingRow = {
  symbol: string;
  /** 시간당 펀딩률 (원본 값). */
  hourly: number;
  /** 연율 환산 퍼센트. */
  annualisedPct: number;
  markPx: number;
  /** 24시간 명목 거래대금 (USD). */
  dayNtlVlm: number;
  kind: "equity" | "index";
};

export type MoveRow = {
  symbol: string;
  markPx: number;
  prevDayPx: number;
  /** 24시간 변동률 퍼센트. 부호 있음. */
  changePct: number;
  dayNtlVlm: number;
  kind: "equity" | "index";
};

export type Insights = {
  /** 펀딩률이 가장 높은 쪽 — 롱이 숏에게 내는 곳. */
  topFunding: FundingRow[];
  /** 가장 낮은(음수) 쪽 — 숏이 롱에게 내는 곳. */
  bottomFunding: FundingRow[];
  /** 24시간 변동 상위 (절대값 기준). */
  topMoves: MoveRow[];
  coverage: Coverage;
  measuredAt: string;
};

type Universe = { name: string; szDecimals: number; maxLeverage: number; isDelisted?: boolean };
type Ctx = { funding: string; markPx: string; prevDayPx: string; dayNtlVlm: string };

/** 심볼이 주식인지 지수·원자재인지. coverage 의 분류기를 그대로 쓴다 — 기준이 갈리면 안 된다. */
function kindOf(symbol: string): "equity" | "index" {
  const a = { index: 0, name: symbol, symbol, szDecimals: 2, maxLeverage: 1, dex: "xyz" } as AssetMeta;
  return classify(a) === "equity" ? "equity" : "index";
}

const short = (name: string) => (name.includes(":") ? name.split(":")[1]! : name);

/**
 * HIP-3 dex 한 곳을 읽어 펀딩·변동을 한 번에 계산한다.
 * `metaAndAssetCtxs` 한 번이면 전 종목이 나오므로 종목당 호출을 하지 않는다.
 */
async function readDex(
  info: hl.InfoClient,
  dex: string,
): Promise<{ funding: FundingRow[]; moves: MoveRow[] }> {
  const [meta, ctxs] = (await info.metaAndAssetCtxs({ dex })) as unknown as [
    { universe: Universe[] },
    Ctx[],
  ];

  const funding: FundingRow[] = [];
  const moves: MoveRow[] = [];

  meta.universe.forEach((u, i) => {
    if (u.isDelisted) return;
    const c = ctxs[i];
    if (!c) return;

    const symbol = short(u.name);
    const kind = kindOf(symbol);
    const markPx = Number(c.markPx);
    const prevDayPx = Number(c.prevDayPx);
    const hourly = Number(c.funding);
    const dayNtlVlm = Number(c.dayNtlVlm);

    // 값이 없는 종목은 통계에서 뺀다. 0 으로 채워 넣으면 순위가 거짓이 된다.
    if (Number.isFinite(hourly) && markPx > 0) {
      funding.push({ symbol, hourly, annualisedPct: annualisedPct(hourly), markPx, dayNtlVlm, kind });
    }
    if (markPx > 0 && prevDayPx > 0) {
      moves.push({
        symbol,
        markPx,
        prevDayPx,
        changePct: ((markPx - prevDayPx) / prevDayPx) * 100,
        dayNtlVlm,
        kind,
      });
    }
  });

  return { funding, moves };
}

/**
 * 게시 소재를 모은다.
 *
 * @param limit 각 순위에서 뽑을 개수
 * @param equitiesOnly 주식만 볼지. 우리 차별점이 토큰화 주식이라 기본은 true.
 */
export async function gatherInsights(
  limit = 3,
  equitiesOnly = true,
  info?: hl.InfoClient,
): Promise<Insights> {
  const client = info ?? new hl.InfoClient({ transport: new hl.HttpTransport() });

  const perDex = await Promise.all(HIP3_DEXES.map((d) => readDex(client, d)));
  const coverage = await measureCoverage(client);

  let funding = perDex.flatMap((r) => r.funding);
  let moves = perDex.flatMap((r) => r.moves);
  if (equitiesOnly) {
    funding = funding.filter((r) => r.kind === "equity");
    moves = moves.filter((r) => r.kind === "equity");
  }

  const byFunding = [...funding].sort((a, b) => b.hourly - a.hourly);
  const byMove = [...moves].sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct));

  return {
    topFunding: byFunding.slice(0, limit),
    bottomFunding: byFunding.slice(-limit).reverse(),
    topMoves: byMove.slice(0, limit),
    coverage,
    measuredAt: new Date().toISOString(),
  };
}
