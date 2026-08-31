// Hyperliquid 퍼펫.
//
// 이 파일이 이 프로젝트의 유일한 거래 관문이다. 채팅·REST·텔레그램·디스코드·CLI·대시보드가
// 전부 아래 4개 함수만 부른다. 그래서 **시그니처를 바꾸지 않는다** — 안쪽만 모드에 따라 갈린다.
//
//   PAPER (기본)  로컬 원장에 기록. Hyperliquid 실시세로 평가만 한다. 주문은 안 나간다.
//   LIVE          실제 주문. 모든 주문에 builder code 가 붙어 거래액의 0.1%가 내 지갑에 쌓인다.
//
// LIVE 는 HL_MODE=live + 트레이더 키 + builder 주소 셋이 모두 있을 때만 켜진다.
// 하나라도 없으면 PAPER 로 떨어진다 (lib/hl/config.ts 의 tradeMode 참고).

import fs from "node:fs/promises";
import path from "node:path";
import { writeJson } from "./storage";
import { adjustBalance, getBalances } from "./ledger";
import { LEVERAGE_CAP, TRADER_KEY, modeReason, tradeMode } from "./hl/config";
import { agentKeyOf, getUser } from "./users";
import {
  closeLive,
  livePositions,
  midPrice,
  openLive,
  resolveAsset,
  traderAddress,
  TradeError,
} from "./hl/trade";

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
  await writeJson(PERPS_PATH, perps);
}

/**
 * 누구의 주문인가. 생략하면 운영자(env 키)로 동작한다 —
 * 그래서 기존 4인자 호출이 그대로 살아 있다.
 */
export interface TradeContext {
  /** 유저 식별자. 주면 그 유저의 agent 지갑으로 서명한다. */
  userId?: string;
}

/**
 * 이 요청에 쓸 서명 키와 조회 주소를 정한다.
 * 유저 컨텍스트면 유저의 agent 키, 아니면 운영자 키.
 */
async function resolveSigner(ctx?: TradeContext): Promise<{ key: string; queryAddress: `0x${string}` | null; who: string }> {
  if (ctx?.userId) {
    const u = await getUser(ctx.userId);
    if (!u) throw new Error(`등록되지 않은 유저: ${ctx.userId}`);
    const key = await agentKeyOf(ctx.userId);
    if (!key) throw new Error(`${ctx.userId} 의 agent 지갑이 없습니다. 먼저 생성하세요.`);
    if (!u.agentApproved) throw new Error(`${ctx.userId} 가 아직 Hyperliquid 에서 agent 지갑을 승인하지 않았습니다.`);
    // 포지션은 유저의 **메인 지갑** 기준이다 (agent 는 서명만 한다)
    return { key, queryAddress: u.mainAddress, who: ctx.userId };
  }
  return { key: TRADER_KEY, queryAddress: TRADER_KEY ? traderAddress(TRADER_KEY) : null, who: "operator" };
}

const PAPER_NOTE = "페이퍼 퍼펫 — Hyperliquid 실시세로 평가, 실주문 아님";
const liveNote = (s: string[]) => `LIVE — ${s.join(" · ")} (builder fee 부착됨)`;

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** 현재 거래 모드와 그 이유. "왜 페이퍼지?" 를 사용자가 스스로 확인할 수 있게 노출한다. */
export function perpMode() {
  const mode = tradeMode();
  return {
    mode,
    reason: modeReason(),
    trader: mode === "live" ? traderAddress(TRADER_KEY) : null,
  };
}

/**
 * 실시세. 메인 perp dex 뿐 아니라 HIP-3 dex(주식·지수·원자재)도 조회된다 —
 * SKHX(SK하이닉스)·SMSN(삼성전자)·DRAM(D램 지수) 같은 심볼이 여기서 살아난다.
 */
export async function getPerpMid(coin: string): Promise<number> {
  return midPrice(coin);
}

export async function openPerp(
  coin: string,
  direction: "long" | "short",
  marginUsdc: number,
  leverage: number,
  ctx?: TradeContext,
) {
  if (!Number.isFinite(marginUsdc) || marginUsdc <= 0)
    return { ok: false as const, error: "증거금(marginUsdc)은 0보다 커야 합니다" };
  if (!Number.isFinite(leverage) || leverage < 1 || leverage > LEVERAGE_CAP)
    return { ok: false as const, error: `레버리지는 1~${LEVERAGE_CAP}배` };

  const upper = coin.trim().toUpperCase();

  // ── LIVE ────────────────────────────────────────────────
  if (tradeMode() === "live") {
    try {
      const signer = await resolveSigner(ctx);
      const r = await openLive({
        privateKey: signer.key,
        symbol: upper,
        side: direction,
        marginUsdc,
        leverage,
      });
      if (!r.ok) return { ok: false as const, error: r.error };
      const position = {
        coin: upper,
        direction,
        marginUsdc,
        leverage,
        sizeCoin: Number(r.action.orders[0]?.s ?? 0),
        entryPrice: Number(r.action.orders[0]?.p ?? 0),
      };
      const result = { ok: true as const, position, note: liveNote(r.statuses) };
      await (await import("./webhook")).notifyTrade("perp.opened", result);
      return result;
    } catch (e) {
      return { ok: false as const, error: e instanceof TradeError ? e.message : errMsg(e) };
    }
  }

  // ── PAPER ───────────────────────────────────────────────
  try {
    await resolveAsset(upper); // 없는 심볼이면 페이퍼에서도 거부한다
  } catch (e) {
    return { ok: false as const, error: errMsg(e) };
  }

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

  const result = {
    ok: true as const,
    position: { coin: upper, direction, marginUsdc, leverage, sizeCoin, entryPrice },
    note: PAPER_NOTE,
  };
  await (await import("./webhook")).notifyTrade("perp.opened", result);
  return result;
}

export async function closePerp(coin: string, ctx?: TradeContext) {
  const upper = coin.trim().toUpperCase();

  // ── LIVE ────────────────────────────────────────────────
  if (tradeMode() === "live") {
    try {
      const signer = await resolveSigner(ctx);
      if (!signer.queryAddress) return { ok: false as const, error: `${signer.who} 의 조회 주소가 없습니다 (메인 지갑 미등록).` };
      const state = await livePositions(signer.queryAddress);
      const pos = state.positions.find((p) => p.coin === upper);
      if (!pos || pos.szi === 0) return { ok: false as const, error: `${upper} 포지션 없음` };

      const r = await closeLive({ privateKey: signer.key, symbol: upper, positionSize: pos.szi });
      if (!r.ok) return { ok: false as const, error: r.error };

      const result = {
        ok: true as const,
        coin: upper,
        entryPrice: pos.entryPx,
        markPrice: await getPerpMid(upper),
        pnlUsd: pos.unrealizedPnl,
        returnedUsdc: 0, // 실계좌에서는 마진이 계정으로 환원된다 — 별도 원장이 없다
        note: liveNote(r.statuses),
      };
      await (await import("./webhook")).notifyTrade("perp.closed", result);
      return result;
    } catch (e) {
      return { ok: false as const, error: e instanceof TradeError ? e.message : errMsg(e) };
    }
  }

  // ── PAPER ───────────────────────────────────────────────
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

export async function getPerpPositions(ctx?: TradeContext) {
  // ── LIVE ────────────────────────────────────────────────
  if (tradeMode() === "live") {
    try {
      const signer = await resolveSigner(ctx);
      if (!signer.queryAddress) return { positions: [], note: `${signer.who} 의 조회 주소가 없습니다 (메인 지갑 미등록).` };
      const state = await livePositions(signer.queryAddress);
      return {
        positions: state.positions.map((p) => ({
          coin: p.coin,
          dir: (p.szi >= 0 ? 1 : -1) as 1 | -1,
          sizeCoin: Math.abs(p.szi),
          entryPrice: p.entryPx,
          marginUsdc: 0,
          leverage: p.leverage,
          markPrice: p.entryPx,
          unrealizedPnlUsd: p.unrealizedPnl,
        })),
        accountValue: state.accountValue,
        withdrawable: state.withdrawable,
        note: "LIVE — 온체인 실제 포지션",
      };
    } catch (e) {
      return { positions: [], note: `LIVE 조회 실패: ${errMsg(e)}` };
    }
  }

  // ── PAPER ───────────────────────────────────────────────
  const perps = await readPerps();
  const withMark = await Promise.all(
    perps.positions.map(async (p) => {
      const mark = await getPerpMid(p.coin);
      const uPnl = (mark - p.entryPrice) * p.sizeCoin * p.dir;
      return { ...p, markPrice: mark, unrealizedPnlUsd: uPnl };
    }),
  );
  return { positions: withMark, note: PAPER_NOTE };
}
