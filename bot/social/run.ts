// 소셜 봇 실행기.
//
// 유저 0명에서 벗어나기 위한 유입 채널이다. 두 가지를 한다:
//   1) 하루 몇 번 실측 관찰을 게시한다 (팔로워 0명일 때 답글만 기다리면 아무 일도 안 일어난다)
//   2) 멘션에 답한다 (답글 하나가 공개된 광고가 된다)
//
// 두뇌는 bot/agent.ts 의 runAgent 를 그대로 쓴다. 텔레그램·디스코드와 같은 에이전트다.
//
// **기본은 dry-run 이다.** 외부에 글을 쓰는 건 되돌릴 수 없다. 켜는 건 사람이 명시적으로 한다.

import "../../lib/env";
import path from "node:path";
import type { ModelMessage } from "ai";
import { runAgent } from "../agent";
import { gatherInsights } from "../../lib/insights";
import { canSpend, spend, peekBudget, type ChannelName } from "../../lib/social/budget";
import { readJson, writeJson, ReadOnlyStorageError } from "../../lib/storage";
import { farcaster } from "./farcaster";
import { x } from "./x";
import { draftsFrom, assertNoPromise, assertFits, MAX_LEN, type Draft } from "./templates";
import type { Channel, Mention } from "./types";

const CHANNELS: Record<ChannelName, Channel> = { farcaster, x };

const argv = process.argv.slice(2);
const has = (f: string) => argv.includes(f);
const val = (f: string, d: string) => {
  const i = argv.indexOf(f);
  return i >= 0 && argv[i + 1] ? argv[i + 1]! : d;
};

/** dry-run 이 기본이다. 실제 게시는 --live 와 SOCIAL_DRY_RUN=0 을 둘 다 요구한다. */
const DRY = !(has("--live") && process.env.SOCIAL_DRY_RUN === "0");
const ONCE = has("--once");
const POSTS_PER_DAY = Number(process.env.SOCIAL_POSTS_PER_DAY ?? "3");
const POLL_MS = Number(process.env.SOCIAL_POLL_MS ?? "60000");

const statePath = () => path.join(process.cwd(), "data", "social-state.json");

type State = {
  /** 채널별 마지막으로 처리한 멘션 id. */
  lastMention: Record<string, string>;
  /** 이미 답한 멘션 id — 같은 멘션에 두 번 답하지 않는다. */
  replied: string[];
  /** 채널별 마지막 게시 시각(ms). */
  lastPostAt: Record<string, number>;
};

const EMPTY_STATE = (): State => ({ lastMention: {}, replied: [], lastPostAt: {} });

async function loadState(): Promise<State> {
  const s = await readJson<State>(statePath(), EMPTY_STATE());
  return { ...EMPTY_STATE(), ...s, replied: s.replied ?? [] };
}

async function saveState(s: State): Promise<void> {
  try {
    // 최근 500건만 기억한다. 무한히 커지면 폴링마다 파일이 무거워진다.
    await writeJson(statePath(), { ...s, replied: s.replied.slice(-500) });
  } catch (e) {
    if (e instanceof ReadOnlyStorageError) {
      // 기록을 못 하면 다음 폴링에 같은 멘션에 또 답한다. 조용히 넘어가면 안 된다.
      console.warn(`⚠️  상태를 저장할 수 없습니다 — 중복 답글이 날 수 있습니다: ${e.message}`);
      return;
    }
    throw e;
  }
}

const log = (...a: unknown[]) => console.log(...a);

/** 게시/답글 한 건. 예산을 먼저 확인하고, dry-run 이면 출력만 한다. */
async function send(
  ch: Channel,
  text: string,
  link: string | undefined,
  mention: Mention | undefined,
): Promise<boolean> {
  assertNoPromise(text);
  assertFits(text, ch.name, link);

  const action = link ? "postWithLink" : "post";

  if (DRY) {
    const b = await peekBudget(ch.name);
    log(`\n  ── DRY-RUN [${ch.name}] ${mention ? `reply→@${mention.author}` : "post"} ` +
        `(비용 예상 $${(await import("../../lib/social/budget")).costOf(ch.name, action)}, ` +
        `이번 달 $${b.spentUsd.toFixed(3)}/$${b.capUsd})`);
    log(text.split("\n").map((l) => "     " + l).join("\n"));
    if (link) log(`     ${link}`);
    return true;
  }

  const r = await spend(ch.name, action);
  if (!r.allowed) {
    log(`  ⏭  [${ch.name}] 건너뜀 — ${r.reason}`);
    return false;
  }

  if (mention) await ch.reply(mention, text, { link });
  else await ch.post(text, { link });
  log(`  ✅ [${ch.name}] ${mention ? "답글" : "게시"} 완료 (이번 달 $${r.state.spentUsd.toFixed(3)}/$${r.state.capUsd})`);
  return true;
}

/** 멘션을 읽고 에이전트로 답한다. */
async function handleMentions(ch: Channel, state: State): Promise<void> {
  // 자격증명이 없으면 호출해봐야 401/402 다. dry-run 미리보기라도 네트워크를 때리지 않는다.
  if (!ch.configured()) {
    log(`  [${ch.name}] 자격증명이 없어 멘션 조회를 건너뜁니다`);
    return;
  }
  if (!DRY && !(await canSpend(ch.name, "read"))) {
    log(`  ⏭  [${ch.name}] 멘션 읽기 건너뜀 — 예산 초과`);
    return;
  }

  let mentions: Mention[];
  try {
    mentions = await ch.fetchMentions(state.lastMention[ch.name]);
  } catch (e) {
    log(`  ⚠️  [${ch.name}] 멘션 조회 실패: ${e instanceof Error ? e.message : e}`);
    return;
  }
  if (!DRY) await spend(ch.name, "read");

  const fresh = mentions.filter((m) => !state.replied.includes(m.id));
  if (fresh.length === 0) {
    log(`  [${ch.name}] 새 멘션 없음`);
    return;
  }
  log(`  [${ch.name}] 새 멘션 ${fresh.length}건`);

  for (const m of fresh) {
    const history: ModelMessage[] = [{ role: "user", content: m.text }];
    let answer: string;
    try {
      answer = await runAgent(history);
    } catch (e) {
      log(`  ⚠️  [${ch.name}] 에이전트 실패: ${e instanceof Error ? e.message : e}`);
      continue;
    }

    // 길이 상한을 넘으면 자르지 않고 줄인 안내로 대체한다. 잘린 숫자는 틀린 숫자다.
    const trimmed = answer.trim();
    const fits = trimmed.length <= MAX_LEN[ch.name] - 40;
    const text = fits ? trimmed : "That needs more room than this thread allows — the full answer is in the terminal.";
    const link = fits ? undefined : `${process.env.PUBLIC_SITE_URL ?? "https://onlyusdc.com"}/terminal`;

    try {
      const ok = await send(ch, text, link, m);
      if (!ok) break; // 예산이 막혔으면 남은 멘션도 마찬가지다
    } catch (e) {
      log(`  ⚠️  [${ch.name}] 전송 거부: ${e instanceof Error ? e.message : e}`);
      continue;
    }
    state.replied.push(m.id);
  }

  if (mentions[0]) state.lastMention[ch.name] = mentions[0].id;
}

/** 하루 N회 게시. 마지막 게시 이후 충분히 지났을 때만. */
async function maybePost(ch: Channel, state: State, drafts: Draft[]): Promise<void> {
  const gapMs = (24 * 60 * 60 * 1000) / Math.max(1, POSTS_PER_DAY);
  const last = state.lastPostAt[ch.name] ?? 0;
  const due = Date.now() - last >= gapMs;

  if (!due && !ONCE) {
    const mins = Math.ceil((gapMs - (Date.now() - last)) / 60000);
    log(`  [${ch.name}] 다음 게시까지 ${mins}분`);
    return;
  }

  if (drafts.length === 0) {
    log(`  [${ch.name}] 게시할 관찰이 없습니다 (데이터 없음)`);
    return;
  }

  // 회차마다 다른 관찰을 낸다. 같은 글을 반복하면 스팸이다.
  const idx = Math.floor(last / gapMs) % drafts.length;
  const d = drafts[idx]!;

  try {
    await send(ch, d.text, d.link, undefined);
    state.lastPostAt[ch.name] = Date.now();
  } catch (e) {
    log(`  ⚠️  [${ch.name}] 게시 거부: ${e instanceof Error ? e.message : e}`);
  }
}

async function tick(channels: Channel[], state: State): Promise<void> {
  // 한 tick 안에서는 모든 채널이 **같은 관측치**를 쓴다.
  // 채널마다 새로 읽으면 같은 시각에 다른 숫자가 나가고, 그건 둘 중 하나가 틀렸다는 뜻이다.
  const drafts = draftsFrom(await gatherInsights(3));
  for (const ch of channels) {
    await maybePost(ch, state, drafts);
    await handleMentions(ch, state);
  }
  await saveState(state);
}

async function main(): Promise<void> {
  const want = val("--channel", "all");
  const selected = (want === "all" ? (["farcaster", "x"] as const) : [want as ChannelName])
    .map((n) => CHANNELS[n])
    .filter(Boolean);

  if (selected.length === 0) {
    console.error(`❌ 알 수 없는 채널: ${want} (farcaster | x | all)`);
    process.exit(1);
  }

  // 정확히 쓴다: dry-run 도 시세를 읽고, 자격증명이 있으면 멘션도 읽는다.
  // 하지 않는 것은 **게시와 답글**이다.
  log(DRY ? "DRY-RUN — 게시·답글을 실제로 올리지 않습니다 (읽기는 합니다)." : "🔴 LIVE — 실제로 게시합니다.");
  if (DRY) log("   실제 게시하려면: SOCIAL_DRY_RUN=0 npm run bot:social -- --live\n");

  const ready: Channel[] = [];
  for (const ch of selected) {
    if (ch.configured()) {
      ready.push(ch);
      continue;
    }
    log(`\n⚠️  [${ch.name}] 자격증명 없음 — 건너뜁니다.`);
    log(ch.setupHint().split("\n").map((l) => "   " + l).join("\n"));
    // dry-run 에서는 자격증명이 없어도 문구를 보여준다. 무엇이 나갈지 미리 봐야 한다.
    if (DRY) ready.push(ch);
  }

  const state = await loadState();
  await tick(ready, state);

  if (ONCE) return;
  log(`\n폴링 시작 — ${POLL_MS / 1000}초 간격. Ctrl+C 로 중지.`);
  for (;;) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    await tick(ready, state);
  }
}

main().catch((e) => {
  console.error("❌ 소셜 봇 실패:", e instanceof Error ? e.message : e);
  process.exit(1);
});
