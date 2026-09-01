// 게시 문구.
//
// 규칙 하나: **문장은 insights 객체의 필드만 보간한다.** 새 숫자를 여기서 만들지 않는다.
// 랜딩이 scripts/test-hook.ts 로 수익 약속을 금지하듯, 게시물도 같은 규율을 받는다.
// 소셜에 올린 숫자가 틀리면 스크린샷으로 남아 영원히 따라다닌다.
//
// 영어로 쓴다 — 청중이 글로벌이다. 한국어 대화는 텔레그램에 이미 있다.

import type { Insights } from "../../lib/insights";

/** 소수 자리를 고정해 읽기 좋게. 값 자체는 바꾸지 않는다. */
const pct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
const usd = (n: number) =>
  n >= 1 ? `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : `$${n.toPrecision(3)}`;

export type Draft = {
  /** 어떤 관찰인지 — 로그·테스트에서 구분용. */
  kind: "funding" | "move" | "coverage";
  text: string;
  /** 링크는 본문과 분리한다. X 에서 비용이 13배 차이나기 때문이다. */
  link?: string;
};

const SITE = process.env.PUBLIC_SITE_URL ?? "https://onlyusdc.com";

/**
 * 지금 시점의 관찰로 초안을 만든다.
 *
 * 데이터가 없으면 그 초안은 만들지 않는다 — 빈 자리를 문구로 메우지 않는다.
 */
export function draftsFrom(ins: Insights): Draft[] {
  const out: Draft[] = [];

  const top = ins.topFunding[0];
  if (top) {
    out.push({
      kind: "funding",
      text:
        `Funding on tokenized equity perps right now:\n` +
        `${top.symbol} pays ${pct(top.annualisedPct)} annualised to shorts. ` +
        `Mark ${usd(top.markPx)}.\n` +
        `Read straight from Hyperliquid HIP-3 — ${ins.coverage.equities} equities live.`,
      link: `${SITE}/metrics`,
    });
  }

  const mv = ins.topMoves[0];
  if (mv) {
    out.push({
      kind: "move",
      text:
        `Biggest 24h move among on-chain equity perps: ` +
        `${mv.symbol} ${pct(mv.changePct)}, ${usd(mv.prevDayPx)} → ${usd(mv.markPx)}.\n` +
        `These markets do not close.`,
      link: `${SITE}/metrics`,
    });
  }

  out.push({
    kind: "coverage",
    text:
      `${ins.coverage.total} markets you can reach by chatting: ` +
      `${ins.coverage.crypto} crypto, ${ins.coverage.equities} tokenized equities, ` +
      `${ins.coverage.indicesCommodities} indices and commodities.\n` +
      `No token minted. Settled only in USDC.`,
    link: `${SITE}/metrics`,
  });

  return out;
}

/**
 * 게시 전 마지막 관문.
 *
 * 수익을 약속하는 표현이 하나라도 있으면 던진다. 봇은 사람이 검토하지 않고 글을 올리므로,
 * 여기서 막지 못하면 아무도 못 막는다.
 */
const BANNED = [
  "guaranteed", "guarantee", "risk-free", "riskless", "sure thing", "can't lose", "cannot lose",
  "profit", "returns of", "will make you", "get rich", "moon", "100x", "financial advice",
  "buy now", "don't miss", "act fast",
];

export function assertNoPromise(text: string): void {
  const lower = text.toLowerCase();
  const hit = BANNED.filter((w) => lower.includes(w));
  if (hit.length > 0) {
    throw new Error(`게시 문구에 수익 약속 표현이 있습니다: ${hit.join(", ")}`);
  }
}

/** 채널별 길이 상한. 넘으면 자르지 않고 던진다 — 잘린 숫자는 틀린 숫자다. */
export const MAX_LEN = { x: 280, farcaster: 1024 } as const;

export function assertFits(text: string, channel: keyof typeof MAX_LEN, link?: string): void {
  // 링크도 본문과 함께 전송되므로 길이에 포함해서 센다.
  const total = text.length + (link ? link.length + 1 : 0);
  if (total > MAX_LEN[channel]) {
    throw new Error(`${channel} 길이 상한 ${MAX_LEN[channel]} 초과: ${total}자`);
  }
}
