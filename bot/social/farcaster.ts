// Farcaster 커넥터 (Neynar).
//
// 여기부터 시작하는 이유: 무료 티어로 월 수백 답글이 되고, 청중이 크립토 네이티브라
// 우리 재고(HIP-3 토큰화 주식 퍼프)와 맞는다. Bankr 도 Farcaster 피드에서 시작했다.
//
// 웹훅 대신 폴링을 쓴다 — 웹훅은 공개 URL 이 필요하고, 지금은 그럴 단계가 아니다.

import type { Channel, Mention, SendOpts } from "./types";

const API = "https://api.neynar.com/v2/farcaster";

const KEY = () => process.env.NEYNAR_API_KEY ?? "";
const SIGNER = () => process.env.NEYNAR_SIGNER_UUID ?? "";
const FID = () => process.env.FARCASTER_FID ?? "";

type NotifCast = {
  hash: string;
  text: string;
  author?: { username?: string };
};

async function call<T>(pathname: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${pathname}`, {
    ...init,
    headers: { "x-api-key": KEY(), "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    throw new Error(`Neynar ${pathname} 실패 (HTTP ${res.status}): ${(await res.text()).slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export const farcaster: Channel = {
  name: "farcaster",

  configured() {
    return Boolean(KEY() && SIGNER() && FID());
  },

  setupHint() {
    return (
      "NEYNAR_API_KEY / NEYNAR_SIGNER_UUID / FARCASTER_FID 가 없습니다.\n" +
      "1) neynar.com 가입 → 무료 플랜 → API key 복사\n" +
      "2) 봇 계정용 signer 생성 → signer_uuid 복사\n" +
      "3) 봇 계정의 FID 확인 (프로필에 표시됨)\n" +
      "4) .env.local 에 추가: NEYNAR_API_KEY=... NEYNAR_SIGNER_UUID=... FARCASTER_FID=...\n" +
      "5) npm run bot:social 재실행"
    );
  },

  async fetchMentions(sinceId?: string) {
    const r = await call<{ notifications?: { cast?: NotifCast }[] }>(
      `/notifications?fid=${encodeURIComponent(FID())}&type=mentions`,
    );
    const out: Mention[] = [];
    for (const n of r.notifications ?? []) {
      const c = n.cast;
      if (!c?.hash) continue;
      // sinceId 를 만나면 그 이후는 이미 처리한 것들이다.
      if (sinceId && c.hash === sinceId) break;
      out.push({
        id: c.hash,
        text: c.text ?? "",
        author: c.author?.username ?? "unknown",
        permalink: `https://warpcast.com/~/conversations/${c.hash}`,
      });
    }
    return out;
  },

  async reply(mention: Mention, text: string, opts: SendOpts = {}) {
    await call("/cast", {
      method: "POST",
      body: JSON.stringify({
        signer_uuid: SIGNER(),
        text: opts.link ? `${text}\n${opts.link}` : text,
        parent: mention.id,
      }),
    });
  },

  async post(text: string, opts: SendOpts = {}) {
    await call("/cast", {
      method: "POST",
      body: JSON.stringify({
        signer_uuid: SIGNER(),
        text: opts.link ? `${text}\n${opts.link}` : text,
      }),
    });
  },
};
