// Hyperliquid 퍼펫 — 시세는 공개 info API(실데이터), 포지션은 페이퍼
// 실주문 서명은 Phase 2에서 교체하는 지점

const HL_INFO =
  process.env.HL_NETWORK === "testnet"
    ? "https://api.hyperliquid-testnet.xyz/info"
    : "https://api.hyperliquid.xyz/info";

import fs from "node:fs/promises";
import path from "node:path";
import { adjustBalance, getBalances } from "./ledger";

const PERPS_PATH = path.join(process.cwd(), "data", "perps.json");

export interface PerpPosition {
  coin: string;
  dir: 1 | -1; // 1=long, -1=short
  sizeCoin: number;
  entryPrice: number;
  marginUsdc: number;
  leverage: number;
}

interface PerpsFile {
  positions: PerpPosition[];
}

async function readPerps(): Promise<PerpsFile> {
  try {
    return JSON.parse(await fs.readFile(PERPS_PATH, "utf8")) as PerpsFile;
  } catch {
    return { positions: [] };
  }
}

async function writePerps(perps: PerpsFile): Promise<void> {
  await fs.mkdir(path.dirname(PERPS_PATH), { recursive: true });
  await fs.writeFile(PERPS_PATH, JSON.stringify(perps, null, 2) + "\n", "utf8");
}

export async function getPerpMid(coin: string): Promise<number> {
  const res = await fetch(HL_INFO, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ type: "allMids" }),
  });
  if (!res.ok) throw new Error(`Hyperliquid 응답 오류: HTTP ${res.status}`);
  const mids = (await res.json()) as Record<string, string>;
  const mid = mids[coin.trim().toUpperCase()];
  if (!mid) throw new Error(`Hyperliquid에 없는 코인: ${coin}`);
  return Number(mid);
}

export async function openPerp(coin: string, direction: "long" | "short", marginUsdc: number, leverage: number) {
  if (!Number.isFinite(marginUsdc) || marginUsdc <= 0)
    return { ok: false as const, error: "증거금(marginUsdc)은 0보다 커야 합니다" };
  if (!Number.isFinite(leverage) || leverage < 1 || leverage > 20)
    return { ok: false as const, error: "레버리지는 1~20배" };

  const upper = coin.trim().toUpperCase();
  const usdc = (await getBalances())["usdc"] ?? 0;
  if (usdc < marginUsdc)
    return { ok: false as const, error: `잔고 부족: usdc ${usdc} 보유, 증거금 ${marginUsdc} 요청` };

  const perps = await readPerps();
  if (perps.positions.some((p) => p.coin === upper))
    return { ok: false as const, error: `${upper} 포지션이 이미 있음 — close 후 다시 시도` };

  const entryPrice = await getPerpMid(upper);
  const sizeCoin = (marginUsdc * leverage) / entryPrice;
  perps.positions.push({
    coin: upper,
    dir: direction === "long" ? 1 : -1,
    sizeCoin,
    entryPrice,
    marginUsdc,
    leverage,
  });
  await writePerps(perps);
  await adjustBalance("usdc", -marginUsdc); // 증거금 예치
  await (await import("./webhook")).notifyTrade("perp.opened", {
    ok: true as const,
    position: { coin: upper, direction, marginUsdc, leverage, sizeCoin, entryPrice },
    note: "페이퍼 퍼펫 — Hyperliquid 실시간 mark로만 평가, 실주문 아님",
  });

  return {
    ok: true as const,
    position: { coin: upper, direction, marginUsdc, leverage, sizeCoin, entryPrice },
    note: "페이퍼 퍼펫 — Hyperliquid 실시간 mark로만 평가, 실주문 아님",
  };
}

export async function closePerp(coin: string) {
  const upper = coin.trim().toUpperCase();
  const perps = await readPerps();
  const pos = perps.positions.find((p) => p.coin === upper);
  if (!pos) return { ok: false as const, error: `${upper} 포지션 없음` };

  const mark = await getPerpMid(upper);
  const pnl = (mark - pos.entryPrice) * pos.sizeCoin * pos.dir;
  perps.positions = perps.positions.filter((p) => p !== pos);
  await writePerps(perps);
  await adjustBalance("usdc", pos.marginUsdc + pnl); // 증거금 + 손익 정산

  const result = {
    ok: true as const,
    coin: upper,
    entryPrice: pos.entryPrice,
    markPrice: mark,
    pnlUsd: pnl,
    returnedUsdc: pos.marginUsdc + pnl,
    note: "페이퍼 정산",
  };
  await (await import("./webhook")).notifyTrade("perp.closed", result);
  return result;
}

export async function getPerpPositions() {
  const perps = await readPerps();
  const withMark = await Promise.all(
    perps.positions.map(async (p) => {
      const mark = await getPerpMid(p.coin);
      const uPnl = (mark - p.entryPrice) * p.sizeCoin * p.dir;
      return { ...p, markPrice: mark, unrealizedPnlUsd: uPnl };
    })
  );
  return { positions: withMark, note: "페이퍼 퍼펫" };
}
