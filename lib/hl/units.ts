/**
 * builder fee 단위 변환.
 *
 * Hyperliquid는 같은 수수료를 두 곳에서 다른 단위로 받는다:
 *
 *   1. 주문 첨부:  action.builder = { b: 주소, f: 100 }
 *      f 의 단위는 "tenths of basis points" — 10분의 1 베이시스포인트.
 *      1 bp = 10 f.  0.1% = 10 bp = f 100.
 *
 *   2. 유저 승인: approveBuilderFee({ maxFeeRate: "0.1%" })
 *      이건 퍼센트 문자열이다.
 *
 * 이 둘을 섞으면 조용히 100배 틀린다 (f=0.1 은 정수가 아니라 거부되고,
 * maxFeeRate="100%" 는 통과해버린다). 그래서 변환은 이 파일 밖에서 금지.
 */

import { MAX_PERP_FEE_PERCENT, MAX_SPOT_FEE_PERCENT } from "./config";

/** f 단위(tenths-of-bps)의 절대 상한. SDK 스키마와 동일: 0..1000 */
export const MAX_F = 1000;

/**
 * 퍼센트 → f (tenths of basis points).
 * 0.1  → 100
 * 0.01 → 10
 * 1    → 1000
 */
export function percentToF(percent: number): number {
  if (!Number.isFinite(percent) || percent < 0) {
    throw new Error(`수수료율이 유효하지 않습니다: ${percent}`);
  }
  // 1% = 100 bp = 1000 tenths-of-bps  →  percent * 1000
  const f = percent * 1000;
  // 부동소수 오차 제거: 0.1*1000 이 99.99999 로 떨어지는 경우 방지
  const rounded = Math.round(f * 1e6) / 1e6;
  if (!Number.isInteger(rounded)) {
    throw new Error(
      `수수료율 ${percent}% 는 f 단위 정수로 표현할 수 없습니다 (f=${rounded}). ` +
        `0.001% 배수만 가능합니다.`,
    );
  }
  if (rounded > MAX_F) {
    throw new Error(`수수료율 ${percent}% 가 상한(${MAX_F / 1000}%)을 넘습니다.`);
  }
  return rounded;
}

/** f (tenths of basis points) → 퍼센트. percentToF 의 역함수. */
export function fToPercent(f: number): number {
  if (!Number.isInteger(f) || f < 0 || f > MAX_F) {
    throw new Error(`f 값이 유효하지 않습니다: ${f} (0..${MAX_F} 정수)`);
  }
  return f / 1000;
}

/**
 * approveBuilderFee 에 넣을 퍼센트 문자열.
 * HL 스키마가 `${string}%` 를 요구한다. 후행 0은 제거한다.
 * 0.1 → "0.1%"
 */
export function percentToMaxFeeRate(percent: number): `${string}%` {
  if (!Number.isFinite(percent) || percent < 0) {
    throw new Error(`수수료율이 유효하지 않습니다: ${percent}`);
  }
  // f 로 한 번 왕복시켜 표현 가능한 값인지 검증한다
  const f = percentToF(percent);
  const normalized = fToPercent(f);
  // 최대 3자리 소수 (0.001% 해상도), 후행 0 제거
  const s = normalized.toFixed(3).replace(/\.?0+$/, "");
  return `${s}%` as `${string}%`;
}

/** "0.1%" → 0.1 */
export function maxFeeRateToPercent(rate: string): number {
  const m = /^(\d+(?:\.\d+)?)%$/.exec(rate.trim());
  if (!m) throw new Error(`maxFeeRate 형식이 잘못됐습니다: ${rate}`);
  return Number(m[1]);
}

/** 이 요율이 해당 시장에서 허용되는가. */
export function assertFeeWithinCap(percent: number, market: "perp" | "spot"): void {
  const cap = market === "perp" ? MAX_PERP_FEE_PERCENT : MAX_SPOT_FEE_PERCENT;
  if (percent > cap) {
    throw new Error(
      `${market} builder fee ${percent}% 가 Hyperliquid 상한 ${cap}% 를 넘습니다. ` +
        `주문이 거부됩니다.`,
    );
  }
}

/** 명목가와 요율로 내가 벌 수수료(USD)를 계산한다. */
export function feeUsd(notionalUsd: number, percent: number): number {
  return notionalUsd * (percent / 100);
}
