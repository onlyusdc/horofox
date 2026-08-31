// USD 시세.
//
// 원래 CoinGecko 무료 티어를 썼는데 두 곳에서 깨졌다:
//   · 배포된 Worker 에서 403 (Cloudflare 대역이 차단됨)
//   · 로컬 반복 호출에서 429 (레이트리밋)
// 우리는 Hyperliquid 에이전트다. 시세를 남의 무료 API 에 의존할 이유가 없고,
// 실제로 거래하는 가격과 표시 가격이 다른 것도 이상하다.
//
// 그래서 **Hyperliquid 를 1순위**로 쓰고, 거기 없는 심볼만 CoinGecko 로 넘긴다.

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { price: number; at: number }>();

/** HL 에 없는 것만 CoinGecko 로 간다 (밈코인 등). */
const SYMBOL_TO_ID: Record<string, string> = {
  usdc: "usd-coin",
  usdt: "tether",
  degen: "degen",
};

async function fromHyperliquid(symbol: string): Promise<number | null> {
  try {
    const { assets } = await import("./hl/trade");
    const { getMid, makeInfoClient } = await import("./hl/core");
    const a = (await assets()).get(symbol.trim().toUpperCase());
    if (!a) return null;
    const px = await getMid(makeInfoClient(), a);
    return px > 0 ? px : null;
  } catch {
    return null;
  }
}

async function fromCoinGecko(symbol: string): Promise<number> {
  const s = symbol.trim().toLowerCase();
  const id = SYMBOL_TO_ID[s] ?? s;
  const res = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=usd`,
    { headers: { accept: "application/json" } },
  );
  if (!res.ok) throw new Error(`CoinGecko 응답 오류: HTTP ${res.status}`);
  const json = (await res.json()) as Record<string, { usd?: number }>;
  const price = json[id]?.usd;
  if (typeof price !== "number") throw new Error(`알 수 없는 코인: ${symbol}`);
  return price;
}

export async function getUsdPrice(symbol: string): Promise<number> {
  const key = symbol.trim().toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.price;

  // 1순위: Hyperliquid — 우리가 실제로 거래하는 가격
  const hl = await fromHyperliquid(symbol);
  if (hl !== null) {
    cache.set(key, { price: hl, at: Date.now() });
    return hl;
  }

  // 2순위: CoinGecko — HL 에 없는 심볼 (스테이블·밈코인 등)
  const cg = await fromCoinGecko(symbol);
  cache.set(key, { price: cg, at: Date.now() });
  return cg;
}

/** 이 심볼을 Hyperliquid 에서 직접 볼 수 있는가. 표시용. */
export async function isOnHyperliquid(symbol: string): Promise<boolean> {
  return (await fromHyperliquid(symbol)) !== null;
}
