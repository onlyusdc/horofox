// CoinGecko 시세 조회 (무료 티어, 키 불필요) + 30초 메모리 캐시

const SYMBOL_TO_ID: Record<string, string> = {
  eth: "ethereum",
  btc: "bitcoin",
  sol: "solana",
  bnb: "binancecoin",
  usdc: "usd-coin",
  usdt: "tether",
  ada: "cardano",
  doge: "dogecoin",
  pepe: "pepe",
  degen: "degen",
};

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { price: number; at: number }>();

function toCoinGeckoId(symbol: string): string {
  const s = symbol.trim().toLowerCase();
  return SYMBOL_TO_ID[s] ?? s; // 모르는 심볼이면 CoinGecko id로 간주
}

export async function getUsdPrice(symbol: string): Promise<number> {
  const id = toCoinGeckoId(symbol);
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.price;

  const res = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=usd`,
    { headers: { accept: "application/json" } }
  );
  if (!res.ok) throw new Error(`CoinGecko 응답 오류: HTTP ${res.status}`);
  const json = (await res.json()) as Record<string, { usd?: number }>;
  const price = json[id]?.usd;
  if (typeof price !== "number") throw new Error(`알 수 없는 코인: ${symbol}`);
  cache.set(id, { price, at: Date.now() });
  return price;
}
