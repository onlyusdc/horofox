// builder 수수료 — 이 서비스의 유일한 실매출.
//
// 로컬 JSON 에 적립되는 페이퍼 수수료와 달리, 이건 Hyperliquid 가 집계한 온체인 값이다.
// 아무도 거래하지 않으면 0 이다. 0.1% × 0 = $0.

import { makeInfoClient } from "./core";
import { BUILDER_ADDRESS, PERP_FEE_PERCENT } from "./config";

export type BuilderRevenue = {
  builder: string;
  cumulativeUsd: number;
  feePercent: number;
  configured: boolean;
};

/** 내 builder 주소가 지금까지 번 누적 수수료(USDC). */
export async function builderRevenue(): Promise<BuilderRevenue> {
  if (!BUILDER_ADDRESS) {
    return { builder: "", cumulativeUsd: 0, feePercent: PERP_FEE_PERCENT, configured: false };
  }
  const info = makeInfoClient();
  const r = await info.referral({ user: BUILDER_ADDRESS as `0x${string}` });
  const raw = (r as { builderRewards?: string }).builderRewards ?? "0";
  const cumulativeUsd = Number(raw);
  if (!Number.isFinite(cumulativeUsd)) throw new Error(`builderRewards 파싱 실패: ${raw}`);
  return { builder: BUILDER_ADDRESS, cumulativeUsd, feePercent: PERP_FEE_PERCENT, configured: true };
}

/** 목표 매출까지 필요한 월 거래량. */
export function volumeNeededForUsd(targetUsd: number, percent = PERP_FEE_PERCENT): number {
  if (percent <= 0) throw new Error("수수료율이 0이면 어떤 거래량으로도 목표에 도달할 수 없습니다.");
  return targetUsd / (percent / 100);
}

/** 활성 유저 n명이 인당 월 v달러를 거래할 때 예상 월 매출. */
export function projectMonthlyUsd(users: number, monthlyVolumePerUser: number, percent = PERP_FEE_PERCENT): number {
  return users * monthlyVolumePerUser * (percent / 100);
}

/** 일별 builder 체결 CSV. 주소는 반드시 소문자 (HL 이 대소문자를 구분한다). */
export function builderFillsUrl(date: Date, builder = BUILDER_ADDRESS): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `https://stats-data.hyperliquid.xyz/Mainnet/builder_fills/${builder.toLowerCase()}/${y}${m}${d}.csv.lz4`;
}
