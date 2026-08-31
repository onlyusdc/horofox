/**
 * Hyperliquid 클라이언트 래퍼.
 *
 * 이 파일의 유일한 계약: **모든 주문에 builder code 가 붙는다.**
 * buildOrderAction 이 유일한 주문 생성 경로이고, builder 는 선택 인자가 아니다.
 * 우회 경로를 만들지 말 것 — 그게 매출이 0이 되는 방법이다.
 */

import * as hl from "@nktkas/hyperliquid";
import {
  BUILDER_ADDRESS,
  PERP_FEE_PERCENT,
  DEFAULT_SLIPPAGE,
  IS_TESTNET,
} from "./config";
import { percentToF, assertFeeWithinCap } from "./units";
import { formatPrice, sizeFromUsd, slippagePrice } from "./rounding";
import type { Side, TpSl } from "./types";

export type AssetMeta = {
  /** 주문의 `a` 필드에 그대로 넣는 값. HIP-3는 오프셋이 적용된 값이다. */
  index: number;
  /** HL 심볼. HIP-3는 "xyz:SKHX" 형태. */
  name: string;
  /** 표시용 짧은 심볼 ("SKHX"). */
  symbol: string;
  szDecimals: number;
  maxLeverage: number;
  /** 소속 dex. 메인 perp dex는 null. */
  dex: string | null;
};

/**
 * HIP-3(빌더 배포 perp dex) 자산 ID 공식.
 *   assetId = 100000 + perpDexIndex * 10000 + indexInMeta
 * 메인 perp dex는 오프셋 없이 meta 순번을 그대로 쓴다.
 *
 * 이걸 틀리면 주문이 **다른 자산으로 나간다**. 추측 금지 — 공식 문서 값이다.
 * @see https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/asset-ids
 */
export const HIP3_ASSET_OFFSET = 100_000;
export const HIP3_DEX_STRIDE = 10_000;

export function assetId(indexInMeta: number, perpDexIndex: number | null): number {
  if (perpDexIndex === null || perpDexIndex === 0) return indexInMeta;
  if (!Number.isInteger(perpDexIndex) || perpDexIndex < 0) {
    throw new Error(`perpDexIndex 가 유효하지 않습니다: ${perpDexIndex}`);
  }
  if (indexInMeta >= HIP3_DEX_STRIDE) {
    throw new Error(`meta 인덱스가 dex 간격(${HIP3_DEX_STRIDE})을 넘습니다: ${indexInMeta}`);
  }
  return HIP3_ASSET_OFFSET + perpDexIndex * HIP3_DEX_STRIDE + indexInMeta;
}

/** action.builder 필드. b=빌더 주소, f=tenths-of-bps. */
export type BuilderField = { b: `0x${string}`; f: number };

export type HlOrder = {
  a: number;
  b: boolean;
  p: string;
  s: string;
  r: boolean;
  t: { limit: { tif: "Gtc" | "Ioc" | "Alo" } } | { trigger: { isMarket: boolean; triggerPx: string; tpsl: "tp" | "sl" } };
};

export type OrderAction = {
  orders: HlOrder[];
  grouping: "na" | "normalTpsl" | "positionTpsl";
  builder: BuilderField;
};

/**
 * 내 builder 필드를 만든다. 단위 변환은 units.ts 에서만.
 *
 * 주소가 없으면 **던진다**. 조용히 builder 없는 주문을 내보내면 유저에게는 정상
 * 체결이지만 나에게는 매출이 0이다. 그 실패는 눈에 안 보여서 가장 위험하다.
 */
export function builderField(percent = PERP_FEE_PERCENT): BuilderField {
  assertFeeWithinCap(percent, "perp");
  if (!BUILDER_ADDRESS || !/^0x[0-9a-f]{40}$/.test(BUILDER_ADDRESS)) {
    throw new Error(
      `HL_BUILDER_ADDRESS 가 설정되지 않았거나 형식이 잘못됐습니다: "${BUILDER_ADDRESS}". ` +
        `수수료를 받을 지갑 주소(0x… 40자)를 넣으세요.`,
    );
  }
  return { b: BUILDER_ADDRESS as `0x${string}`, f: percentToF(percent) };
}

export type BuildOrderInput = {
  asset: AssetMeta;
  side: Side;
  /** 명목가 USD (담보 × 레버리지) */
  notionalUsd: number;
  /** 현재 중간가. 시장가 환산과 TP/SL 퍼센트 계산에 쓴다. */
  midPx: number;
  /** 지정가. 없으면 슬리피지 IOC 시장가. */
  limitPx?: number;
  tp?: TpSl;
  sl?: TpSl;
  slippage?: number;
  feePercent?: number;
};

/**
 * 주문 액션을 만든다. 순수 함수 — 네트워크를 타지 않아 테스트 가능하다.
 *
 * TP/SL 이 있으면 grouping="normalTpsl" 로 묶어 한 번에 보낸다.
 * TP/SL 주문은 reduceOnly 이고 수량은 진입과 동일하다.
 */
export function buildOrderAction(input: BuildOrderInput): OrderAction {
  const { asset, side, notionalUsd, midPx } = input;
  const isBuy = side === "long";
  const slippage = input.slippage ?? DEFAULT_SLIPPAGE;

  const entryPx =
    input.limitPx !== undefined
      ? formatPrice(input.limitPx, asset.szDecimals, "perp")
      : slippagePrice(midPx, isBuy, slippage, asset.szDecimals, "perp");

  // 수량은 지정가가 있으면 그 가격 기준, 없으면 중간가 기준으로 환산한다.
  const refPx = input.limitPx ?? midPx;
  const size = sizeFromUsd(notionalUsd, refPx, asset.szDecimals);

  const orders: HlOrder[] = [
    {
      a: asset.index,
      b: isBuy,
      p: entryPx,
      s: size,
      r: false,
      t: { limit: { tif: input.limitPx !== undefined ? "Gtc" : "Ioc" } },
    },
  ];

  const trigger = (t: TpSl, kind: "tp" | "sl"): HlOrder => {
    const px = resolveTriggerPrice(t, refPx, side, kind);
    return {
      a: asset.index,
      b: !isBuy, // 청산 방향은 진입의 반대
      p: formatPrice(px, asset.szDecimals, "perp"),
      s: size,
      r: true,
      t: { trigger: { isMarket: true, triggerPx: formatPrice(px, asset.szDecimals, "perp"), tpsl: kind } },
    };
  };

  if (input.tp) orders.push(trigger(input.tp, "tp"));
  if (input.sl) orders.push(trigger(input.sl, "sl"));

  return {
    orders,
    grouping: orders.length > 1 ? "normalTpsl" : "na",
    builder: builderField(input.feePercent),
  };
}

/**
 * TP/SL 트리거 가격을 절대가로 환산한다.
 * 퍼센트는 **진입가 대비 가격 변화율**로 해석한다 (ROE 아님).
 * 롱 익절 +20% → 진입가 × 1.20, 롱 손절 5% → 진입가 × 0.95.
 */
export function resolveTriggerPrice(
  t: TpSl,
  entryPx: number,
  side: Side,
  kind: "tp" | "sl",
): number {
  if (t.type === "price") return t.value;
  const pct = Math.abs(t.value) / 100;
  const up = (kind === "tp") === (side === "long"); // 롱 익절/숏 손절은 위, 나머지는 아래
  return up ? entryPx * (1 + pct) : entryPx * (1 - pct);
}

/** reduceOnly 청산 주문. 포지션 크기의 일부/전부를 시장가로 닫는다. */
export function buildCloseAction(params: {
  asset: AssetMeta;
  /** 현재 포지션 수량 (부호 포함: 양수=롱, 음수=숏) */
  positionSize: number;
  fraction: number;
  midPx: number;
  slippage?: number;
  feePercent?: number;
}): OrderAction {
  const { asset, positionSize, fraction, midPx } = params;
  if (positionSize === 0) throw new Error("닫을 포지션이 없습니다.");
  if (fraction <= 0 || fraction > 1) throw new Error(`청산 비율이 유효하지 않습니다: ${fraction}`);

  const isLong = positionSize > 0;
  const closeIsBuy = !isLong; // 롱을 닫으려면 판다
  const slippage = params.slippage ?? DEFAULT_SLIPPAGE;
  const absSize = Math.abs(positionSize) * fraction;

  return {
    orders: [
      {
        a: asset.index,
        b: closeIsBuy,
        p: slippagePrice(midPx, closeIsBuy, slippage, asset.szDecimals, "perp"),
        s: formatSizeForClose(absSize, asset.szDecimals),
        r: true,
        t: { limit: { tif: "Ioc" } },
      },
    ],
    grouping: "na",
    builder: builderField(params.feePercent),
  };
}

function formatSizeForClose(sz: number, szDecimals: number): string {
  const rounded = Number(sz.toFixed(szDecimals));
  if (rounded <= 0) throw new Error("청산 수량이 반올림 후 0이 됩니다.");
  const s = rounded.toFixed(szDecimals);
  return s.includes(".") ? s.replace(/\.?0+$/, "") : s;
}

/** 모든 주문 액션에 builder 가 붙어 있는지 검증한다. 실행 직전 마지막 방어선. */
export function assertBuilderAttached(action: OrderAction): void {
  if (!action.builder) {
    throw new Error("builder code 가 없는 주문입니다. 수수료가 걷히지 않습니다.");
  }
  const { b, f } = action.builder;
  if (!/^0x[0-9a-f]{40}$/.test(b) || b === "0x0000000000000000000000000000000000000000") {
    throw new Error(`builder 주소가 유효하지 않습니다: ${b}`);
  }
  if (!Number.isInteger(f) || f <= 0 || f > 1000) {
    throw new Error(`builder f 값이 유효하지 않습니다: ${f}`);
  }
}

// ─────────────────────────────── 네트워크 계층 ───────────────────────────────

export function makeInfoClient(): hl.InfoClient {
  return new hl.InfoClient({
    transport: new hl.HttpTransport(IS_TESTNET ? { isTestnet: true } : {}),
  });
}

/**
 * 자산 메타를 심볼 → AssetMeta 로 인덱싱한다.
 *
 * 메인 perp dex뿐 아니라 HIP-3 dex도 함께 읽는다. 이게 없으면 SKHX·SMSN·DRAM 같은
 * 주식·지수 퍼프에 아예 도달할 수 없다 (메인 universe에 없기 때문).
 *
 * 심볼은 짧은 이름("SKHX")과 정식 이름("xyz:SKHX") 둘 다로 조회 가능하게 넣는다.
 * 짧은 이름이 여러 dex에 겹치면 **거래량이 큰 dex를 먼저 읽어** 선점하게 한다.
 */
export async function loadAssets(
  info: hl.InfoClient,
  dexes: readonly string[] = HIP3_DEXES,
): Promise<Map<string, AssetMeta>> {
  const map = new Map<string, AssetMeta>();

  const add = (a: AssetMeta) => {
    map.set(a.name, a);
    // 짧은 심볼은 선점 우선 — 먼저 등록된 dex를 이긴 것으로 둔다
    if (!map.has(a.symbol)) map.set(a.symbol, a);
  };

  // 1) 메인 perp dex (오프셋 없음)
  const meta = await info.meta();
  meta.universe.forEach((u, index) => {
    if ((u as { isDelisted?: boolean }).isDelisted) return;
    add({ index, name: u.name, symbol: u.name, szDecimals: u.szDecimals, maxLeverage: u.maxLeverage, dex: null });
  });

  if (dexes.length === 0) return map;

  // 2) HIP-3 dex들. perpDexs() 배열의 순번이 곧 perpDexIndex 다.
  const perpDexs = await info.perpDexs();
  for (const dex of dexes) {
    const perpDexIndex = perpDexs.findIndex((d) => d?.name === dex);
    if (perpDexIndex < 0) continue;
    let dexMeta;
    try {
      [dexMeta] = await info.metaAndAssetCtxs({ dex });
    } catch {
      continue; // 한 dex가 죽어도 나머지는 살린다
    }
    dexMeta.universe.forEach((u, indexInMeta) => {
      if ((u as { isDelisted?: boolean }).isDelisted) return;
      add({
        index: assetId(indexInMeta, perpDexIndex),
        name: u.name,
        symbol: u.name.includes(":") ? u.name.split(":")[1]! : u.name,
        szDecimals: u.szDecimals,
        maxLeverage: u.maxLeverage,
        dex,
      });
    });
  }

  return map;
}

/**
 * 우리가 읽는 HIP-3 dex. 거래량 순.
 * `xyz` 가 주식·지수·원자재 퍼프의 사실상 전부다 (24h $17억, 활성 자산 103종).
 */
export const HIP3_DEXES = ["xyz"] as const;

/** 유저가 내 builder 에게 승인한 최대 요율(퍼센트). 미승인이면 null. */
export async function getApprovedFeePercent(
  info: hl.InfoClient,
  user: `0x${string}`,
): Promise<number | null> {
  const raw = await info.maxBuilderFee({ user, builder: BUILDER_ADDRESS });
  // HL은 tenths-of-bps 정수를 돌려준다. 0이면 미승인.
  if (typeof raw !== "number" || raw <= 0) return null;
  return raw / 1000;
}

/**
 * 중간가 조회. dex마다 별도 호출이라 자산이 어디 속하는지 알아야 한다.
 * `allMids()` 는 메인 dex만 반환하므로, HIP-3 자산을 문자열로 조회하면 항상 실패한다.
 */
export async function getMid(info: hl.InfoClient, asset: AssetMeta): Promise<number> {
  const mids = asset.dex ? await info.allMids({ dex: asset.dex }) : await info.allMids();
  // HIP-3 응답의 키는 정식 이름("xyz:SKHX")이다.
  const raw = mids[asset.name] ?? mids[asset.symbol];
  if (raw === undefined) {
    throw new Error(`${asset.symbol} 의 가격을 찾을 수 없습니다.`);
  }
  const px = Number(raw);
  if (!Number.isFinite(px) || px <= 0) {
    throw new Error(`${asset.symbol} 가격이 비정상입니다: ${raw}`);
  }
  return px;
}
