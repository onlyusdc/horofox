// 에이전트 툴 정의 — 로직은 lib/*에 위임, 스킬은 skills/에서 병합

import { tool } from "ai";
import { z } from "zod";
import { getUsdPrice } from "./price";
import { portfolio, swap } from "./ledger";
import { closePerp, getPerpMid, getPerpPositions, openPerp } from "./perps";
import { buyToken, getLaunchpad, launchToken, sellToken } from "./launchpad";
import { localWalletAddress, onchainBalance } from "./wallet";
import { extraTools } from "../skills";

const SYMBOLS = "eth, btc, sol, bnb, usdc, usdt, ada, doge, pepe, degen";
const HL_COINS = "BTC, ETH, SOL, HYPE, DOGE, XRP, … (Hyperliquid 상장 코인)";

export const tools = {
  getPrice: tool({
    description: `Get the current USD price of a coin (CoinGecko). Supported symbols: ${SYMBOLS}.`,
    inputSchema: z.object({
      symbol: z.string().describe("Coin symbol, e.g. 'eth'"),
    }),
    execute: async ({ symbol }) => {
      try {
        const price = await getUsdPrice(symbol);
        return { ok: true, symbol: symbol.toLowerCase(), usdPrice: price };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    },
  }),

  executeSwap: tool({
    description: `Execute a swap (paper trading — real market price, no on-chain tx). Supported symbols: ${SYMBOLS}.`,
    inputSchema: z.object({
      from: z.string().describe("Symbol to sell, e.g. 'usdc'"),
      to: z.string().describe("Symbol to buy, e.g. 'eth'"),
      amount: z.number().describe("Amount of `from` to swap"),
    }),
    execute: async ({ from, to, amount }) => swap(from, to, amount),
  }),

  getPortfolio: tool({
    description: "Get current balances with USD valuation for each asset and the total.",
    inputSchema: z.object({}),
    execute: async () => portfolio(),
  }),

  getPerpPrice: tool({
    description: `Get the live mid price of a Hyperliquid perpetual market. Coins: ${HL_COINS}`,
    inputSchema: z.object({ coin: z.string().describe("e.g. 'BTC'") }),
    execute: async ({ coin }) => {
      try {
        return { ok: true, coin: coin.toUpperCase(), midPrice: await getPerpMid(coin) };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    },
  }),

  openPerp: tool({
    description: "Open a LONG or SHORT perpetual position (PAPER — margin in USDC from the ledger, real Hyperliquid mark price, 1-20x).",
    inputSchema: z.object({
      coin: z.string().describe("e.g. 'ETH'"),
      direction: z.enum(["long", "short"]),
      marginUsdc: z.number(),
      leverage: z.number().describe("1-20"),
    }),
    execute: async ({ coin, direction, marginUsdc, leverage }) =>
      openPerp(coin, direction, marginUsdc, leverage),
  }),

  closePerp: tool({
    description: "Close a paper perpetual position at the live mark price and settle PnL in USDC.",
    inputSchema: z.object({ coin: z.string() }),
    execute: async ({ coin }) => closePerp(coin),
  }),

  getPerpPositions: tool({
    description: "List open paper perpetual positions with live mark price and unrealized PnL.",
    inputSchema: z.object({}),
    execute: async () => getPerpPositions(),
  }),

  launchToken: tool({
    description: "Launch a new token with a paper bonding curve (initial price 0.0001 USDC). The 1% trading fee accrues to fund compute.",
    inputSchema: z.object({
      name: z.string(),
      symbol: z.string().describe("2-8 alphanumerics, e.g. 'DEMO'"),
    }),
    execute: async ({ name, symbol }) => launchToken(name, symbol),
  }),

  buyToken: tool({
    description: "Buy a launched token from its paper bonding curve with USDC (1% fee).",
    inputSchema: z.object({ symbol: z.string(), usdcAmount: z.number() }),
    execute: async ({ symbol, usdcAmount }) => buyToken(symbol, usdcAmount),
  }),

  sellToken: tool({
    description: "Sell a launched token back to its paper bonding curve for USDC (1% fee).",
    inputSchema: z.object({ symbol: z.string(), tokenAmount: z.number() }),
    execute: async ({ symbol, tokenAmount }) => sellToken(symbol, tokenAmount),
  }),

  getLaunchpad: tool({
    description: "List launched tokens with curve price, holdings, and accrued fees.",
    inputSchema: z.object({}),
    execute: async () => getLaunchpad(),
  }),

  onchainBalance: tool({
    description: "Get the ETH balance of an address on Base Sepolia via public RPC. Omit the address to use the configured wallet (EVM_PRIVATEKEY).",
    inputSchema: z.object({ address: z.string().optional() }),
    execute: async ({ address }) => {
      try {
        return await onchainBalance(address);
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    },
  }),

  ...extraTools,
};

export function walletConfigured(): boolean {
  return localWalletAddress() !== null;
}
