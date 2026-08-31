// 데모용 페이퍼 트레이딩 장부 — JSON 파일 영속화
// 실제 온체인 실행은 다음 변경에서 swap() 내부만 교체

import fs from "node:fs/promises";
import path from "node:path";
import { writeJson } from "./storage";

const LEDGER_PATH = path.join(process.cwd(), "data", "ledger.json");

export interface Ledger {
  balances: Record<string, number>; // 심볼(소문자) → 수량
}

const DEFAULT_LEDGER: Ledger = { balances: { usdc: 1000 } };

async function readLedger(): Promise<Ledger> {
  try {
    const raw = await fs.readFile(LEDGER_PATH, "utf8");
    return JSON.parse(raw) as Ledger;
  } catch {
    return structuredClone(DEFAULT_LEDGER);
  }
}

async function writeLedger(ledger: Ledger): Promise<void> {
  await writeJson(LEDGER_PATH, ledger);
}

const norm = (s: string) => s.trim().toLowerCase();

export async function adjustBalance(symbol: string, delta: number): Promise<number> {
  const ledger = await readLedger();
  const s = norm(symbol);
  ledger.balances[s] = (ledger.balances[s] ?? 0) + delta;
  await writeLedger(ledger);
  return ledger.balances[s];
}

export async function getBalances(): Promise<Record<string, number>> {
  return (await readLedger()).balances;
}

export async function swap(from: string, to: string, amount: number) {
  const f = norm(from);
  const t = norm(to);
  if (f === t) return { ok: false as const, error: "같은 자산끼리 스왑할 수 없습니다" };
  if (!Number.isFinite(amount) || amount <= 0)
    return { ok: false as const, error: "amount는 0보다 큰 숫자여야 합니다" };

  const ledger = await readLedger();
  const bal = ledger.balances[f] ?? 0;
  if (bal < amount)
    return { ok: false as const, error: `잔고 부족: ${f} ${bal} 보유, ${amount} 요청` };

  // 체결가는 호출 시점 실제 시세 (페이퍼 실행: 슬리피지 없음, 플랫폼 수수료 0.5%만)
  const { getUsdPrice } = await import("./price");
  const fromPrice = await getUsdPrice(f);
  const toPrice = await getUsdPrice(t);
  const swapFeeRate = Number(process.env.SWAP_FEE_RATE ?? "0.005");
  const platformFeeUsdc = amount * fromPrice * (Number.isFinite(swapFeeRate) ? swapFeeRate : 0.005);
  const outAmount = Math.max(0, (amount * fromPrice - platformFeeUsdc) / toPrice);

  ledger.balances[f] = bal - amount;
  ledger.balances[t] = (ledger.balances[t] ?? 0) + outAmount;
  await writeLedger(ledger);

  const result = {
    ok: true as const,
    from: { symbol: f, amount },
    to: { symbol: t, amount: outAmount },
    executedPrice: { [f]: fromPrice, [t]: toPrice },
    platformFeeUsdc,
    note: "페이퍼 트레이딩 — 실제 시세로 체결, 온체인 실행 아님, 플랫폼 수수료 0.5% 포함",
  };
  await (await import("./revenue")).recordRevenue("swap", platformFeeUsdc, `${f}→${t}`);
  await (await import("./webhook")).notifyTrade("swap.executed", result);
  return result;
}

export async function portfolio() {
  const balances = await readLedger().then((l) => l.balances);
  const { getUsdPrice } = await import("./price");
  const assets = await Promise.all(
    Object.entries(balances).map(async ([symbol, amount]) => {
      let price: number | null = null;
      try {
        price = await getUsdPrice(symbol);
      } catch {
        price = null; // 시세를 못 가져와도 수량은 보여준다
      }
      return { symbol, amount, usdPrice: price, usdValue: price === null ? null : amount * price };
    })
  );
  const totalUsd = assets.reduce((sum, a) => sum + (a.usdValue ?? 0), 0);
  return { assets, totalUsd };
}
