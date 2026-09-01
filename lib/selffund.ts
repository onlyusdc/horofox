// 자가자금 루프 — 이 서비스의 엣지.
//
// Bankr 의 플라이휠은 "토큰을 발행해 그 거래 수수료로 에이전트 추론비를 낸다"이다.
// 문제: 발행 매출은 밈코인 사이클에 묶여 있고, 실제로 피크 대비 −92% 로 무너진 전례가 있다.
// 게다가 걔들 스왑 수수료는 0.7% 중 95% 가 창작자 몫이라, 플랫폼이 가져가는 건 1/19 다.
//
// 우리는 같은 루프를 **거래**로 돌린다:
//
//   유저가 거래 → 주문에 builder code → 흐름의 0.1% 가 온체인에 쌓임
//        → 그 수수료를 LLM 크레딧으로 전환 → 에이전트가 자기 추론비를 냄
//
// 토큰을 찍을 필요가 없고, Hyperliquid 가 프로토콜 레벨로 지급하므로
// 경쟁사가 0% 로 면제해 압박할 수 있는 종류의 수수료가 아니다.
// 그리고 Bankr 는 HL 거래를 중개하면서 이 수수료를 걷지 않는다 (문서 192줄에 수취 맥락 0건).

import path from "node:path";
import { readJson, writeJson, ReadOnlyStorageError } from "./storage";
import { builderRevenue } from "./hl/revenue";
import { grantCredits, CALLS_PER_PAYMENT } from "./quota";

const LEDGER_PATH = path.join(process.cwd(), "data", "selffund.json");

/** 크레딧 1회 호출의 원가. quota 의 결제 단가와 같아야 한다 ($0.001/call). */
export const USD_PER_CALL = Number(process.env.SELFFUND_USD_PER_CALL ?? "0.001");

/** 이 비율만큼만 크레딧으로 돌린다. 나머지는 운영 몫으로 남긴다. */
export const CONVERT_RATIO = Number(process.env.SELFFUND_CONVERT_RATIO ?? "0.5");

/** 크레딧을 받을 주체. 기본은 운영자 풀. */
export const POOL_SUBJECT = process.env.SELFFUND_POOL_SUBJECT ?? "pool:operator";

type Ledger = {
  /** 마지막으로 크레딧 전환에 반영한 누적 수수료(USDC). 멱등성의 핵심. */
  settledUsd: number;
  /** 지금까지 전환한 총 호출 수. */
  grantedCalls: number;
  history: { at: string; deltaUsd: number; calls: number }[];
};

const EMPTY: Ledger = { settledUsd: 0, grantedCalls: 0, history: [] };

async function read(): Promise<Ledger> {
  const l = await readJson<Ledger>(LEDGER_PATH, EMPTY);
  return { ...EMPTY, ...l, history: l.history ?? [] };
}

export type SelfFundState = {
  /** 온체인 누적 builder 수수료 (USDC). */
  earnedUsd: number;
  /** 그중 이미 크레딧으로 전환한 몫. */
  settledUsd: number;
  /** 아직 전환하지 않은 몫. */
  pendingUsd: number;
  /** 지금 전환하면 나올 호출 수. */
  convertibleCalls: number;
  grantedCalls: number;
  ratio: number;
  usdPerCall: number;
  builderConfigured: boolean;
  /** 저장이 불가능한 환경인가 (읽기 전용 배포). */
  degraded: boolean;
  note?: string;
};

/** 미정산분으로 몇 회를 살 수 있는지. 소수점은 버린다 — 없는 크레딧을 만들지 않는다. */
export function callsFor(pendingUsd: number, ratio = CONVERT_RATIO, usdPerCall = USD_PER_CALL): number {
  if (!(usdPerCall > 0)) throw new Error(`호출 단가가 유효하지 않습니다: ${usdPerCall}`);
  if (!(ratio > 0 && ratio <= 1)) throw new Error(`전환 비율이 유효하지 않습니다: ${ratio}`);
  if (!(pendingUsd > 0)) return 0;
  return Math.floor((pendingUsd * ratio) / usdPerCall);
}

/** 수수료 조회기. 테스트가 온체인 호출 없이 결정론적으로 돌 수 있도록 주입 가능하게 둔다. */
export type RevenueReader = typeof builderRevenue;

/** 현재 상태만 본다 (전환하지 않음). */
export async function peekSelfFund(revenue: RevenueReader = builderRevenue): Promise<SelfFundState> {
  const l = await read();
  let earnedUsd = 0;
  let builderConfigured = false;
  let note: string | undefined;
  try {
    const r = await revenue();
    earnedUsd = r.cumulativeUsd;
    builderConfigured = r.configured;
    if (!r.configured) note = "HL_BUILDER_ADDRESS 미설정 — 수수료를 받을 주소가 없습니다.";
  } catch (e) {
    note = `수수료 조회 실패: ${e instanceof Error ? e.message : String(e)}`;
  }

  // 온체인 값이 원장보다 작아질 수는 없다. 작다면 주소를 바꾼 것이므로 0 으로 본다.
  const pendingUsd = Math.max(0, earnedUsd - l.settledUsd);

  return {
    earnedUsd,
    settledUsd: l.settledUsd,
    pendingUsd,
    convertibleCalls: callsFor(pendingUsd),
    grantedCalls: l.grantedCalls,
    ratio: CONVERT_RATIO,
    usdPerCall: USD_PER_CALL,
    builderConfigured,
    degraded: false,
    note,
  };
}

/**
 * 미정산 수수료를 LLM 크레딧으로 전환한다.
 *
 * **멱등**: 이미 정산한 누적액(`settledUsd`)을 원장에 남겨 두 번 세지 않는다.
 * 한 번 더 호출해도 새 수수료가 들어오지 않았으면 0회를 부여한다.
 */
// 정산은 read-modify-write 다. 운영자가 버튼을 두 번 누르거나 크론과 겹치면
// 두 호출이 같은 미정산액을 보고 각자 크레딧을 부여한다. 그래서 직렬화한다.
// ponytail: 프로세스 내 직렬화. 인스턴스가 여러 개면 원장을 공유 저장소로 올려야 한다.
let settleChain: Promise<unknown> = Promise.resolve();

export function settleSelfFund(
  revenue: RevenueReader = builderRevenue,
): Promise<SelfFundState & { granted: number }> {
  const run = settleChain.then(() => settleOnce(revenue), () => settleOnce(revenue));
  settleChain = run.catch(() => undefined);
  return run;
}

async function settleOnce(
  revenue: RevenueReader,
): Promise<SelfFundState & { granted: number }> {
  const state = await peekSelfFund(revenue);
  const calls = state.convertibleCalls;

  if (calls <= 0) {
    return { ...state, granted: 0 };
  }

  // 전환한 만큼만 정산 처리한다. 반올림으로 버린 잔돈은 다음 회차로 넘긴다.
  const usedUsd = (calls * USD_PER_CALL) / CONVERT_RATIO;
  const l = await read();
  const next: Ledger = {
    settledUsd: l.settledUsd + usedUsd,
    grantedCalls: l.grantedCalls + calls,
    history: [...l.history, { at: new Date().toISOString(), deltaUsd: usedUsd, calls }].slice(-100),
  };

  try {
    await grantCredits(POOL_SUBJECT, calls);
    await writeJson(LEDGER_PATH, next);
  } catch (e) {
    if (e instanceof ReadOnlyStorageError) {
      // 저장을 못 하면 다음 호출에 또 전환해 이중 지급이 된다. 그래서 부여를 취소하지 않고
      // degraded 로 알린 뒤 정산은 하지 않는다 — 조용히 넘어가는 것보다 낫다.
      return { ...state, granted: 0, degraded: true, note: e.message };
    }
    throw e;
  }

  return {
    ...state,
    settledUsd: next.settledUsd,
    pendingUsd: Math.max(0, state.earnedUsd - next.settledUsd),
    convertibleCalls: 0,
    grantedCalls: next.grantedCalls,
    granted: calls,
  };
}

/** 목표 크레딧 수를 채우려면 거래량이 얼마나 필요한가. 설명용. */
export function volumeNeededForCalls(calls: number, feePercent = 0.1): number {
  if (!(calls > 0)) return 0;
  const usd = (calls * USD_PER_CALL) / CONVERT_RATIO;
  return usd / (feePercent / 100);
}

export { CALLS_PER_PAYMENT };
