// 페이퍼 토큰 런치패드 — 가상 본딩커브(x·y=k) + 1% 수수료 적립
// Bankr의 "거래 수수료 → 컴퓨팅비" 플라이휠을 페이퍼로 시연하는 모듈

import fs from "node:fs/promises";
import path from "node:path";
import { adjustBalance, getBalances } from "./ledger";

const TOKENS_PATH = path.join(process.cwd(), "data", "tokens.json");
const FEE_RATE = 0.01;

export interface LaunchToken {
  name: string;
  symbol: string; // 대문자
  reserveToken: number;
  reserveUsdc: number;
  feesUsdc: number;
  createdAt: string;
}

interface TokensFile {
  tokens: Record<string, LaunchToken>;
}

async function readTokens(): Promise<TokensFile> {
  try {
    return JSON.parse(await fs.readFile(TOKENS_PATH, "utf8")) as TokensFile;
  } catch {
    return { tokens: {} };
  }
}

async function writeTokens(file: TokensFile): Promise<void> {
  await fs.mkdir(path.dirname(TOKENS_PATH), { recursive: true });
  await fs.writeFile(TOKENS_PATH, JSON.stringify(file, null, 2) + "\n", "utf8");
}

export const priceOf = (t: LaunchToken) => t.reserveUsdc / t.reserveToken;

export async function launchToken(name: string, symbol: string) {
  const sym = symbol.trim().toUpperCase();
  if (!/^[A-Z0-9]{2,8}$/.test(sym)) return { ok: false as const, error: "심볼은 영문/숫자 2~8자" };
  if (!name.trim()) return { ok: false as const, error: "이름 필요" };

  const file = await readTokens();
  if (file.tokens[sym]) return { ok: false as const, error: `${sym}은 이미 발행됨` };

  const token: LaunchToken = {
    name: name.trim(),
    symbol: sym,
    reserveToken: 1_000_000,
    reserveUsdc: 100,
    feesUsdc: 0,
    createdAt: new Date().toISOString(),
  };
  file.tokens[sym] = token;
  await writeTokens(file);

  return { ok: true as const, token, initialPriceUsdc: priceOf(token) };
}

async function loadToken(symbol: string) {
  const sym = symbol.trim().toUpperCase();
  const file = await readTokens();
  const token = file.tokens[sym];
  return token ? { file, token } : null;
}

export async function buyToken(symbol: string, usdcAmount: number) {
  if (!Number.isFinite(usdcAmount) || usdcAmount <= 0)
    return { ok: false as const, error: "usdcAmount는 0보다 큰 숫자" };
  const loaded = await loadToken(symbol);
  if (!loaded) return { ok: false as const, error: `없는 토큰: ${symbol}` };
  const { file, token } = loaded;

  const usdcBal = (await getBalances())["usdc"] ?? 0;
  if (usdcBal < usdcAmount)
    return { ok: false as const, error: `잔고 부족: usdc ${usdcBal} 보유` };

  const fee = usdcAmount * FEE_RATE;
  const net = usdcAmount - fee;
  const k = token.reserveUsdc * token.reserveToken;
  const out = token.reserveToken - k / (token.reserveUsdc + net);

  token.reserveUsdc += net;
  token.reserveToken -= out;
  token.feesUsdc += fee;
  file.tokens[token.symbol] = token;
  await writeTokens(file);
  await adjustBalance("usdc", -usdcAmount);
  await adjustBalance(token.symbol.toLowerCase(), out);

  const result = {
    ok: true as const,
    tokenIn: { symbol: "usdc", amount: usdcAmount, fee },
    received: { symbol: token.symbol, amount: out },
    priceAfterUsdc: priceOf(token),
  };
  await (await import("./webhook")).notifyTrade("launchpad.bought", result);
  return result;
}

export async function sellToken(symbol: string, tokenAmount: number) {
  if (!Number.isFinite(tokenAmount) || tokenAmount <= 0)
    return { ok: false as const, error: "tokenAmount는 0보다 큰 숫자" };
  const loaded = await loadToken(symbol);
  if (!loaded) return { ok: false as const, error: `없는 토큰: ${symbol}` };
  const { file, token } = loaded;

  const held = (await getBalances())[token.symbol.toLowerCase()] ?? 0;
  if (held < tokenAmount)
    return { ok: false as const, error: `잔고 부족: ${token.symbol} ${held} 보유` };

  const k = token.reserveUsdc * token.reserveToken;
  const gross = token.reserveUsdc - k / (token.reserveToken + tokenAmount);
  const fee = gross * FEE_RATE;
  const net = gross - fee;

  token.reserveUsdc -= gross;
  token.reserveToken += tokenAmount;
  token.feesUsdc += fee;
  file.tokens[token.symbol] = token;
  await writeTokens(file);
  await adjustBalance(token.symbol.toLowerCase(), -tokenAmount);
  await adjustBalance("usdc", net);

  const result = {
    ok: true as const,
    sold: { symbol: token.symbol, amount: tokenAmount },
    received: { symbol: "usdc", amount: net, fee },
    priceAfterUsdc: priceOf(token),
  };
  await (await import("./webhook")).notifyTrade("launchpad.sold", result);
  return result;
}

export async function getLaunchpad() {
  const file = await readTokens();
  const balances = await getBalances();
  const tokens = Object.values(file.tokens).map((t) => ({
    ...t,
    held: balances[t.symbol.toLowerCase()] ?? 0,
  }));
  const totalFeesUsdc = tokens.reduce((s, t) => s + t.feesUsdc, 0);
  return { tokens, totalFeesUsdc, note: "수수료는 토큰별 적립 — 나중에 컴퓨팅비로 전환되는 루프의 시연" };
}
