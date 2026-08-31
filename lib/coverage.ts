// 자산 커버리지 — 우리 우위를 숫자로 말하기 위한 실측.
//
// 이전에는 랜딩이 `177 + hip3` 로 총계를 만들었다. 177 은 하드코딩이었고,
// 읽는 dex 도 하나뿐이었다. 측정하지 않은 숫자를 우위라고 부를 수는 없다.
//
// 여기서는 loadAssets 가 실제로 도달하는 자산을 그대로 센다.
// 그래야 "우리는 N종에 닿는다"가 검증 가능한 주장이 된다.

import * as hl from "@nktkas/hyperliquid";
import { loadAssets, type AssetMeta } from "./hl/core";

/** 이 심볼들은 주식이 아니라 지수·원자재·FX 다. 분류를 정직하게 하기 위한 목록. */
const NON_EQUITY = new Set([
  "SP500", "XYZ100", "NDX", "NASDAQ", "DJI", "RUSSELL", "VIX", "DAX", "NIKKEI", "KOSPI", "HSI", "FTSE",
  "GOLD", "SILVER", "OIL", "WTI", "BRENT", "COPPER", "NATGAS", "PLATINUM", "PALLADIUM", "URANIUM",
  "EUR", "JPY", "GBP", "KRW", "CNY", "CHF", "AUD", "CAD", "MXN", "BRL",
]);

export type Coverage = {
  /** 우리가 주문을 낼 수 있는 고유 자산 수. */
  total: number;
  /** 메인 perp dex (크립토). */
  crypto: number;
  /** HIP-3 dex 로 들어오는 실물 연동 자산. */
  hip3: number;
  /** HIP-3 중 토큰화 주식으로 분류된 것. */
  equities: number;
  /** HIP-3 중 지수·원자재·FX. */
  indicesCommodities: number;
  /** 읽은 dex 이름들. */
  dexes: string[];
  /** 표본 — 주장이 진짜인지 눈으로 확인할 수 있게. */
  sampleEquities: string[];
  measuredAt: string;
};

/** 이름(예: "xyz:SKHX")이 아니라 심볼 기준의 고유 자산만 센다. */
function uniqueAssets(map: Map<string, AssetMeta>): AssetMeta[] {
  const seen = new Map<number, AssetMeta>();
  for (const a of map.values()) if (!seen.has(a.index)) seen.set(a.index, a);
  return [...seen.values()];
}

export function classify(a: AssetMeta): "crypto" | "equity" | "index" {
  if (a.dex === null) return "crypto";
  return NON_EQUITY.has(a.symbol.toUpperCase()) ? "index" : "equity";
}

export async function measureCoverage(info?: hl.InfoClient): Promise<Coverage> {
  const client = info ?? new hl.InfoClient({ transport: new hl.HttpTransport() });
  const map = await loadAssets(client);
  const assets = uniqueAssets(map);

  const crypto = assets.filter((a) => classify(a) === "crypto");
  const equity = assets.filter((a) => classify(a) === "equity");
  const index = assets.filter((a) => classify(a) === "index");

  return {
    total: assets.length,
    crypto: crypto.length,
    hip3: equity.length + index.length,
    equities: equity.length,
    indicesCommodities: index.length,
    dexes: [...new Set(assets.map((a) => a.dex).filter((d): d is string => d !== null))],
    sampleEquities: equity.slice(0, 8).map((a) => a.symbol),
    measuredAt: new Date().toISOString(),
  };
}
