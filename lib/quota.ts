// 사용량 한도 — Bankr 의 구독을 x402 로 옮긴 것.
//
// Bankr 는 무료 하루 5메시지 → 월 $20 구독으로 푼다. 그 구조는 그대로 두되,
// 결제를 **x402(USDC)** 로 받는다. 카드사도 계정도 필요 없고, 부르는 쪽이
// 사람이 아니라 에이전트여도 스스로 낼 수 있다 — 그게 이 서비스의 고객상에 맞다.
//
// 저장은 storage 층을 쓴다. 읽기 전용 환경(공개 데모)에서는 조용히 사라지지 않고
// 던지므로, 호출부가 "한도 추적 불가"를 사용자에게 알릴 수 있다.

import path from "node:path";
import { readJson, writeJson, ReadOnlyStorageError } from "./storage";

const QUOTA_PATH = path.join(process.cwd(), "data", "quota.json");

/** 무료 한도. Bankr 가 5인데, 우리는 도구라 조금 더 준다. */
export const FREE_CALLS_PER_DAY = Number(process.env.FREE_CALLS_PER_DAY ?? "20");

/** 결제 1회로 열리는 호출 수. $0.001 × 이 값이 실질 단가다. */
export const CALLS_PER_PAYMENT = Number(process.env.CALLS_PER_PAYMENT ?? "100");

type Entry = { day: string; used: number; credits: number };
type QuotaFile = { subjects: Record<string, Entry> };

const today = (now: number) => new Date(now).toISOString().slice(0, 10);

async function read(): Promise<QuotaFile> {
  return readJson<QuotaFile>(QUOTA_PATH, { subjects: {} });
}

function entryOf(f: QuotaFile, subject: string, now: number): Entry {
  const e = f.subjects[subject];
  const d = today(now);
  // 날짜가 바뀌면 무료분만 초기화한다. 결제 크레딧은 이월된다 — 산 걸 뺏지 않는다.
  if (!e) return { day: d, used: 0, credits: 0 };
  return e.day === d ? e : { day: d, used: 0, credits: e.credits };
}

export type QuotaState = {
  subject: string;
  used: number;
  freeLimit: number;
  credits: number;
  remaining: number;
  allowed: boolean;
  /** 한도 추적이 불가능한 환경인가 (읽기 전용 배포). */
  degraded: boolean;
};

function toState(subject: string, e: Entry, degraded = false): QuotaState {
  const freeLeft = Math.max(0, FREE_CALLS_PER_DAY - e.used);
  const remaining = freeLeft + e.credits;
  return {
    subject,
    used: e.used,
    freeLimit: FREE_CALLS_PER_DAY,
    credits: e.credits,
    remaining,
    allowed: remaining > 0,
    degraded,
  };
}

/** 지금 상태만 본다 (차감 없음). */
export async function peek(subject: string, now = Date.now()): Promise<QuotaState> {
  const f = await read();
  return toState(subject, entryOf(f, subject, now));
}

/**
 * 호출 1회를 차감한다. 한도를 넘으면 `allowed: false` 를 돌려주고 차감하지 않는다.
 *
 * 저장이 불가능한 환경에서는 **차단하지 않고** `degraded: true` 로 통과시킨다.
 * 공개 데모에서 한도를 못 세는 건 우리 사정이지, 방문자를 막을 이유가 아니다.
 * (돈이 나가는 경로는 별도로 app/api/chat 의 크기 상한이 막는다.)
 */
export async function consume(subject: string, now = Date.now()): Promise<QuotaState> {
  const f = await read();
  const e = entryOf(f, subject, now);

  if (e.credits <= 0 && e.used >= FREE_CALLS_PER_DAY) {
    return toState(subject, e); // allowed=false
  }

  const next: Entry = e.credits > 0
    ? { ...e, credits: e.credits - 1 }   // 산 크레딧을 먼저 쓴다
    : { ...e, used: e.used + 1 };

  f.subjects[subject] = next;
  try {
    await writeJson(QUOTA_PATH, f);
  } catch (err) {
    if (err instanceof ReadOnlyStorageError) return toState(subject, next, true);
    throw err;
  }
  return toState(subject, next);
}

/** x402 결제가 확인되면 크레딧을 넣는다. */
export async function grantCredits(
  subject: string,
  calls = CALLS_PER_PAYMENT,
  now = Date.now(),
): Promise<QuotaState> {
  if (!Number.isInteger(calls) || calls <= 0) throw new Error(`부여할 호출 수가 유효하지 않습니다: ${calls}`);
  const f = await read();
  const e = entryOf(f, subject, now);
  const next: Entry = { ...e, credits: e.credits + calls };
  f.subjects[subject] = next;
  try {
    await writeJson(QUOTA_PATH, f);
  } catch (err) {
    if (err instanceof ReadOnlyStorageError) return toState(subject, next, true);
    throw err;
  }
  return toState(subject, next);
}

/** 호출자 식별. 인증된 신원이 있으면 그걸, 없으면 IP 를 쓴다. */
export function subjectOf(req: Request, userId?: string | null): string {
  if (userId) return `user:${userId}`;
  const ip =
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  return `ip:${ip}`;
}
