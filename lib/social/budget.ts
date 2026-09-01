// 소셜 채널 지출 상한.
//
// X 는 2026-02 부터 종량제다. 링크가 붙은 게시물 하나가 $0.20 — 링크 없는 게시물 13건 값이다.
// 봇이 답글마다 /metrics 링크를 달면 답글 1,000건에 $200 이 나간다. 우리 매출은 0 이다.
//
// 그래서 상한을 설정이 아니라 **원장**으로 둔다. lib/selffund.ts 와 같은 구조다:
// 누적 지출을 파일에 남기고, 동시 호출을 직렬화하고, 기록에 실패하면 지출을 허용하지 않는다.
//
// quota.ts 는 저장 실패 시 방문자를 통과시킨다 — 한도를 못 세는 건 우리 사정이지 막을 이유가 아니라서다.
// 여기는 반대로 막는다. 기록 없이 돈을 쓰면 얼마 썼는지 영원히 모른다.

import path from "node:path";
import { readJson, writeJson, ReadOnlyStorageError } from "../storage";

export type ChannelName = "farcaster" | "x";
export type Action = "read" | "post" | "postWithLink";

/**
 * 실행당 비용(USD).
 *
 * X 수치는 3rd-party 정리 글에서 온 값이고 공식 페이지로 재확인이 필요하다.
 * 그래서 기본 상한을 낮게 두었다 — 표가 틀려도 피해가 작도록.
 */
export const COST: Record<ChannelName, Record<Action, number>> = {
  x: { read: 0.005, post: 0.015, postWithLink: 0.2 },
  farcaster: { read: 0, post: 0, postWithLink: 0 },
};

// 경로를 상수로 고정하지 않는다. 모듈 로드 시점의 cwd 에 묶이면
// 실행 위치가 바뀌었을 때 엉뚱한 원장을 읽는다.
const ledgerPath = () => path.join(process.cwd(), "data", "social-budget.json");

/** 월 지출 상한(USD). 넘으면 게시 자체를 하지 않는다. */
export const MONTHLY_USD_CAP = Number(process.env.SOCIAL_MONTHLY_USD_CAP ?? "5");

type Entry = { month: string; usd: number; counts: Record<string, number> };
type Ledger = { channels: Record<string, Entry> };

const monthOf = (now: number) => new Date(now).toISOString().slice(0, 7);

async function read(): Promise<Ledger> {
  // fallback 을 모듈 상수로 두면 안 된다. 파일이 없을 때 readJson 이 그 객체를 그대로 돌려주고,
  // spendOnce 가 `l.channels[ch] = ...` 로 그걸 변형하면 다음 호출에도 남는다.
  // 원장이 없거나 쓰기가 막힌 환경에서 지출이 유령처럼 누적돼 상한이 엉뚱하게 걸린다.
  const l = await readJson<Ledger>(ledgerPath(), { channels: {} });
  return { channels: { ...(l.channels ?? {}) } };
}

function entryOf(l: Ledger, ch: ChannelName, now: number): Entry {
  const m = monthOf(now);
  const e = l.channels[ch];
  // 달이 바뀌면 0 부터. 상한은 월 단위다.
  if (!e || e.month !== m) return { month: m, usd: 0, counts: {} };
  return e;
}

export type BudgetState = {
  channel: ChannelName;
  month: string;
  spentUsd: number;
  capUsd: number;
  remainingUsd: number;
  counts: Record<string, number>;
};

function toState(ch: ChannelName, e: Entry): BudgetState {
  return {
    channel: ch,
    month: e.month,
    spentUsd: e.usd,
    capUsd: MONTHLY_USD_CAP,
    remainingUsd: Math.max(0, MONTHLY_USD_CAP - e.usd),
    counts: e.counts,
  };
}

export function costOf(ch: ChannelName, action: Action): number {
  return COST[ch][action];
}

/** 지금 상태만 본다. */
export async function peekBudget(ch: ChannelName, now = Date.now()): Promise<BudgetState> {
  return toState(ch, entryOf(await read(), ch, now));
}

/** 이 행동을 할 여유가 있는가. 비용 0 인 채널은 항상 허용한다. */
export async function canSpend(ch: ChannelName, action: Action, now = Date.now()): Promise<boolean> {
  const c = costOf(ch, action);
  if (c === 0) return true;
  const e = entryOf(await read(), ch, now);
  return e.usd + c <= MONTHLY_USD_CAP;
}

// 지출 기록은 read-modify-write 다. 답글 여러 건이 동시에 나가면 같은 잔액을 보고
// 각자 통과해 상한을 넘긴다. 그래서 직렬화한다.
// ponytail: 프로세스 내 직렬화. 봇을 여러 인스턴스로 돌리면 원장을 공유 저장소로 올려야 한다.
let chain: Promise<unknown> = Promise.resolve();

/**
 * 비용을 원장에 기록하고 허용 여부를 돌려준다.
 *
 * 반환이 `false` 면 **행동을 하지 말아야 한다** — 상한 초과이거나 기록에 실패한 경우다.
 * 호출부는 이 값을 확인하지 않고 게시하면 안 된다.
 */
export function spend(
  ch: ChannelName,
  action: Action,
  now = Date.now(),
): Promise<{ allowed: boolean; state: BudgetState; reason?: string }> {
  const run = chain.then(() => spendOnce(ch, action, now), () => spendOnce(ch, action, now));
  chain = run.catch(() => undefined);
  return run;
}

async function spendOnce(
  ch: ChannelName,
  action: Action,
  now: number,
): Promise<{ allowed: boolean; state: BudgetState; reason?: string }> {
  const cost = costOf(ch, action);
  const l = await read();
  const e = entryOf(l, ch, now);

  if (cost > 0 && e.usd + cost > MONTHLY_USD_CAP) {
    return {
      allowed: false,
      state: toState(ch, e),
      reason: `월 상한 $${MONTHLY_USD_CAP} 초과 — 이미 $${e.usd.toFixed(3)} 썼고 이 행동은 $${cost}`,
    };
  }

  const next: Entry = {
    month: e.month,
    usd: e.usd + cost,
    counts: { ...e.counts, [action]: (e.counts[action] ?? 0) + 1 },
  };
  l.channels[ch] = next;

  try {
    await writeJson(ledgerPath(), l);
  } catch (err) {
    if (err instanceof ReadOnlyStorageError) {
      // 비용 0 이면 기록 못 해도 손해가 없다. 돈이 나가는 경우에만 막는다.
      if (cost === 0) return { allowed: true, state: toState(ch, next) };
      return {
        allowed: false,
        state: toState(ch, e),
        reason: `지출을 기록할 수 없어 거부합니다: ${err.message}`,
      };
    }
    throw err;
  }

  return { allowed: true, state: toState(ch, next) };
}
