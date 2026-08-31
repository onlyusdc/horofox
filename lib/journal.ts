// 체결 저널 — 모든 체결을 data/trades.json에 기록 (대시보드·감사용)
import fs from "node:fs/promises";
import path from "node:path";
import { writeJson } from "./storage";

const TRADES_PATH = path.join(process.cwd(), "data", "trades.json");
const MAX_RECORDS = 200;

export interface TradeRecord {
  event: string;
  data: unknown;
  ts: string;
}

export async function recordTrade(event: string, data: unknown): Promise<void> {
  let records: TradeRecord[] = [];
  try {
    records = JSON.parse(await fs.readFile(TRADES_PATH, "utf8")) as TradeRecord[];
  } catch {
    records = [];
  }
  records.push({ event, data, ts: new Date().toISOString() });
  await writeJson(TRADES_PATH, records.slice(-MAX_RECORDS));
}

export async function getTrades(limit = 50): Promise<TradeRecord[]> {
  let records: TradeRecord[] = [];
  try {
    records = JSON.parse(await fs.readFile(TRADES_PATH, "utf8")) as TradeRecord[];
  } catch {
    records = [];
  }
  return records.slice(-limit).reverse(); // 최신순
}
