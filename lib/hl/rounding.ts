/**
 * Hyperliquid 가격/수량 라운딩.
 *
 * HL 주문 거부의 1위 원인이 여기다. 규칙 (공식 문서):
 *   가격: 유효숫자 5자리 이하  AND  소수점 (MAX_DECIMALS - szDecimals) 자리 이하
 *         MAX_DECIMALS = 퍼프 6, 스팟 8
 *         단, 정수 가격은 유효숫자 제한 없이 항상 허용
 *   수량: 해당 자산의 szDecimals 자리로 반올림
 *   서명 시 후행 0 제거
 */

import { MAX_DECIMALS } from "./config";

/** 후행 0과 불필요한 소수점을 제거한 문자열. HL 서명 요구사항. */
export function stripTrailingZeros(s: string): string {
  if (!s.includes(".")) return s;
  return s.replace(/\.?0+$/, "");
}

/** 유효숫자 n자리로 반올림. */
function toSignificant(value: number, digits: number): number {
  if (value === 0) return 0;
  const magnitude = Math.floor(Math.log10(Math.abs(value)));
  const factor = Math.pow(10, digits - 1 - magnitude);
  return Math.round(value * factor) / factor;
}

/**
 * 주문 가격을 HL이 받는 형태로 변환한다.
 *
 * @param px 원하는 가격
 * @param szDecimals 자산의 szDecimals (meta.universe 에서)
 * @param market "perp" | "spot"
 * @returns HL 에 넣을 가격 문자열
 */
export function formatPrice(
  px: number,
  szDecimals: number,
  market: "perp" | "spot" = "perp",
): string {
  if (!Number.isFinite(px) || px <= 0) {
    throw new Error(`가격이 유효하지 않습니다: ${px}`);
  }

  const maxDecimals = MAX_DECIMALS[market] - szDecimals;
  if (maxDecimals < 0) {
    throw new Error(
      `szDecimals(${szDecimals}) 가 ${market} MAX_DECIMALS(${MAX_DECIMALS[market]}) 보다 큽니다.`,
    );
  }

  // 유효숫자 5자리로 먼저 자른다.
  const sig = toSignificant(px, 5);

  // 그 결과가 정수면 유효숫자 제한이 면제되므로 원래 값을 반올림한 정수를 쓴다.
  // (예: 78785.5 → 유효숫자 5자리 = 78786. 정수라 허용.)
  if (Number.isInteger(sig)) {
    return String(sig);
  }

  // 정수가 아니면 소수점 자리수 제한도 적용한다.
  const clamped = Number(sig.toFixed(maxDecimals));

  // 자리수 제한에 눌려 0이 되는 경우가 있다 (예: 0.00001234 를 소수 1자리로).
  // 여기서 조용히 0을 돌려주면 가격 0짜리 주문이 나간다. 반드시 던진다.
  if (clamped <= 0) {
    throw new Error(
      `가격 ${px} 는 이 자산에서 표현할 수 없습니다 ` +
        `(szDecimals=${szDecimals} → 소수점 ${maxDecimals}자리까지). 반올림하면 0이 됩니다.`,
    );
  }

  return stripTrailingZeros(clamped.toFixed(maxDecimals));
}

/**
 * 주문 수량을 szDecimals 자리로 반올림한다.
 * 반올림 결과가 0이면 주문이 무의미하므로 에러.
 */
export function formatSize(sz: number, szDecimals: number): string {
  if (!Number.isFinite(sz) || sz <= 0) {
    throw new Error(`수량이 유효하지 않습니다: ${sz}`);
  }
  const rounded = Number(sz.toFixed(szDecimals));
  if (rounded <= 0) {
    throw new Error(
      `수량 ${sz} 가 szDecimals(${szDecimals}) 반올림 후 0이 됩니다. 주문액을 키우세요.`,
    );
  }
  return stripTrailingZeros(rounded.toFixed(szDecimals));
}

/**
 * USD 명목가를 코인 수량으로 환산한 뒤 라운딩한다.
 * 레버리지는 수량에 곱하지 않는다 — HL에서 레버리지는 마진 설정이고,
 * 주문 수량은 "명목가 / 가격" 이다. 담보 $100 + 10x = 명목가 $1000.
 */
export function sizeFromUsd(
  notionalUsd: number,
  price: number,
  szDecimals: number,
): string {
  if (price <= 0) throw new Error(`가격이 유효하지 않습니다: ${price}`);
  return formatSize(notionalUsd / price, szDecimals);
}

/**
 * 시장가 주문을 IOC 리밋으로 환산할 때 쓸 공격적 가격.
 * HL은 진짜 시장가가 없어서, 슬리피지만큼 넘겨 건 IOC 리밋을 쓴다.
 */
export function slippagePrice(
  midPx: number,
  isBuy: boolean,
  slippage: number,
  szDecimals: number,
  market: "perp" | "spot" = "perp",
): string {
  const raw = isBuy ? midPx * (1 + slippage) : midPx * (1 - slippage);
  return formatPrice(raw, szDecimals, market);
}
