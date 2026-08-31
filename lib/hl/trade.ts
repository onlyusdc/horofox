// LIVE 거래 실행. 서명은 여기서만 일어난다.
//
// 설계 원칙:
//  1. 트레이더 신원은 **파라미터**다. 전역 키를 직접 읽지 않는다 —
//     나중에 유저별 지갑을 얹을 때 이 파일을 안 고쳐도 되게.
//  2. 주문은 `buildOrderAction`/`buildCloseAction` 만 거친다. 그 둘은 builder 를 강제한다.
//  3. 전송 직전에 `assertBuilderAttached` 로 한 번 더 막는다.

import * as hl from "@nktkas/hyperliquid";
import { privateKeyToAccount } from "viem/accounts";
import {
  assertBuilderAttached,
  buildCloseAction,
  buildOrderAction,
  getMid,
  loadAssets,
  makeInfoClient,
  type AssetMeta,
  type OrderAction,
} from "./core";
import { IS_TESTNET, LEVERAGE_CAP, MIN_ORDER_USD, BUILDER_MIN_PERP_ACCOUNT_USDC } from "./config";
import type { Side } from "./types";

export class TradeError extends Error {}

/** 자산 메타 캐시. 매 주문마다 230+종을 다시 받지 않는다. */
let assetCache: { at: number; map: Map<string, AssetMeta> } | null = null;
const ASSET_TTL_MS = 10 * 60_000;

export async function assets(): Promise<Map<string, AssetMeta>> {
  if (assetCache && Date.now() - assetCache.at < ASSET_TTL_MS) return assetCache.map;
  const map = await loadAssets(makeInfoClient());
  assetCache = { at: Date.now(), map };
  return map;
}

/** 심볼 → 자산. 없으면 사람이 읽을 수 있는 오류. */
export async function resolveAsset(symbol: string): Promise<AssetMeta> {
  const map = await assets();
  const key = symbol.trim().toUpperCase();
  const a = map.get(key) ?? map.get(symbol.trim());
  if (!a) throw new TradeError(`Hyperliquid에 없는 심볼: ${symbol}`);
  return a;
}

export async function midPrice(symbol: string): Promise<number> {
  return getMid(makeInfoClient(), await resolveAsset(symbol));
}

function traderAccount(privateKey: string) {
  const pk = (privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`) as `0x${string}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(pk)) {
    throw new TradeError("트레이더 개인키 형식이 잘못됐습니다 (0x + 64 hex).");
  }
  return privateKeyToAccount(pk);
}

function exchange(privateKey: string) {
  return new hl.ExchangeClient({
    transport: new hl.HttpTransport(IS_TESTNET ? { isTestnet: true } : {}),
    wallet: traderAccount(privateKey),
  });
}

/** 트레이더 주소만 필요할 때 (서명 없이). */
export function traderAddress(privateKey: string): `0x${string}` {
  return traderAccount(privateKey).address;
}

// ───────────────────────────── 검증 ─────────────────────────────

export function assertLeverage(leverage: number, assetMaxLeverage: number): void {
  if (!Number.isFinite(leverage) || leverage < 1) {
    throw new TradeError(`레버리지가 유효하지 않습니다: ${leverage}`);
  }
  if (leverage > assetMaxLeverage) {
    throw new TradeError(`이 자산의 최대 레버리지는 ${assetMaxLeverage}배입니다 (요청 ${leverage}배).`);
  }
  if (leverage > LEVERAGE_CAP) {
    throw new TradeError(`안전을 위해 ${LEVERAGE_CAP}배까지만 허용합니다 (요청 ${leverage}배).`);
  }
}

export function assertMinNotional(notionalUsd: number): void {
  if (notionalUsd < MIN_ORDER_USD) {
    throw new TradeError(`최소 주문 명목가는 $${MIN_ORDER_USD} 입니다 (요청 $${notionalUsd.toFixed(2)}).`);
  }
}

/** 빌더(나) 자신이 자격 요건을 갖췄는지. 미달이면 모든 주문이 거부된다. */
export function assertBuilderEligible(builderPerpAccountUsdc: number): void {
  if (builderPerpAccountUsdc < BUILDER_MIN_PERP_ACCOUNT_USDC) {
    throw new TradeError(
      `빌더 계정 잔고 부족: $${builderPerpAccountUsdc.toFixed(2)} < $${BUILDER_MIN_PERP_ACCOUNT_USDC}. ` +
        `Hyperliquid는 빌더에게 퍼프 계정 $${BUILDER_MIN_PERP_ACCOUNT_USDC} 이상을 요구합니다.`,
    );
  }
}

// ───────────────────────────── 실행 ─────────────────────────────

export type ExecResult = {
  ok: true;
  statuses: string[];
  action: OrderAction;
} | {
  ok: false;
  error: string;
};

/** 액션 하나를 서명해 전송한다. 전송 직전 builder 최종 검증. */
async function submit(privateKey: string, action: OrderAction): Promise<ExecResult> {
  assertBuilderAttached(action);
  try {
    const res = await exchange(privateKey).order(action);
    const statuses = res.response.data.statuses.map((s) => {
      if (typeof s === "string") {
        return s === "waitingForFill" ? "체결 대기"
          : s === "waitingForTrigger" ? "트리거 등록됨 (TP/SL)"
          : s;
      }
      if ("filled" in s) return `체결 ${s.filled.totalSz} @ $${s.filled.avgPx}`;
      if ("resting" in s) return `대기 주문 (oid ${s.resting.oid})`;
      return JSON.stringify(s);
    });
    return { ok: true, statuses, action };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * 포지션 진입.
 * 레버리지는 주문 필드가 아니라 계정 설정이라 **주문보다 먼저** 적용한다.
 * 실패하면 주문을 보내지 않는다 — 의도와 다른 마진으로 열리는 것보다 낫다.
 */
export async function openLive(params: {
  privateKey: string;
  symbol: string;
  side: Side;
  marginUsdc: number;
  leverage: number;
}): Promise<ExecResult & { asset?: AssetMeta; notionalUsd?: number }> {
  const asset = await resolveAsset(params.symbol);
  assertLeverage(params.leverage, asset.maxLeverage);
  const notionalUsd = params.marginUsdc * params.leverage;
  assertMinNotional(notionalUsd);

  const midPx = await getMid(makeInfoClient(), asset);
  const client = exchange(params.privateKey);

  if (params.leverage > 1) {
    try {
      await client.updateLeverage({ asset: asset.index, isCross: false, leverage: params.leverage });
    } catch (e) {
      return { ok: false, error: `레버리지 설정 실패로 주문 중단: ${e instanceof Error ? e.message : String(e)}` };
    }
  }

  const action = buildOrderAction({ asset, side: params.side, notionalUsd, midPx });
  const r = await submit(params.privateKey, action);
  return { ...r, asset, notionalUsd };
}

/** 포지션 청산 (reduceOnly 시장가). */
export async function closeLive(params: {
  privateKey: string;
  symbol: string;
  positionSize: number;
  fraction?: number;
}): Promise<ExecResult> {
  const asset = await resolveAsset(params.symbol);
  if (params.positionSize === 0) return { ok: false, error: `${params.symbol} 포지션이 없습니다.` };
  const midPx = await getMid(makeInfoClient(), asset);
  const action = buildCloseAction({
    asset,
    positionSize: params.positionSize,
    fraction: params.fraction ?? 1,
    midPx,
  });
  return submit(params.privateKey, action);
}

/** 실제 온체인 포지션 조회. */
export async function livePositions(address: `0x${string}`) {
  const info = makeInfoClient();
  const st = await info.clearinghouseState({ user: address });
  return {
    accountValue: Number(st.marginSummary.accountValue),
    withdrawable: Number(st.withdrawable),
    positions: st.assetPositions.map((p) => ({
      coin: p.position.coin,
      szi: Number(p.position.szi),
      entryPx: Number(p.position.entryPx ?? 0),
      unrealizedPnl: Number(p.position.unrealizedPnl),
      leverage: p.position.leverage.value,
    })),
  };
}

/** 주문을 만들되 전송하지 않는다. 페이로드 검증·미리보기용. */
export async function buildOnly(params: {
  symbol: string;
  side: Side;
  marginUsdc: number;
  leverage: number;
}): Promise<{ action: OrderAction; asset: AssetMeta; midPx: number; notionalUsd: number }> {
  const asset = await resolveAsset(params.symbol);
  assertLeverage(params.leverage, asset.maxLeverage);
  const notionalUsd = params.marginUsdc * params.leverage;
  assertMinNotional(notionalUsd);
  const midPx = await getMid(makeInfoClient(), asset);
  const action = buildOrderAction({ asset, side: params.side, notionalUsd, midPx });
  assertBuilderAttached(action);
  return { action, asset, midPx, notionalUsd };
}
