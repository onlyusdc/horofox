// X 커넥터.
//
// 2026-02 부터 무료 티어가 없고 종량제다. 읽기 $0.005 · 게시 $0.015 · **링크 포함 게시 $0.20**.
// 그래서 이 파일은 돈을 쓰는 코드고, 호출부(run.ts)가 lib/social/budget 으로 매번 막는다.
// 여기서는 예산 판단을 하지 않는다 — 판단이 두 곳에 흩어지면 한 곳이 낡는다.
//
// 게시는 OAuth 1.0a user context 로 서명해야 한다. 라이브러리를 새로 넣지 않고
// node:crypto 로 만든다 (텔레그램 커넥터가 fetch 만 쓰는 것과 같은 방침).

import { createHmac, randomBytes } from "node:crypto";
import type { Channel, Mention, SendOpts } from "./types";

const API = "https://api.x.com/2";

const CK = () => process.env.X_API_KEY ?? "";
const CS = () => process.env.X_API_SECRET ?? "";
const AT = () => process.env.X_ACCESS_TOKEN ?? "";
const AS = () => process.env.X_ACCESS_SECRET ?? "";
const UID = () => process.env.X_USER_ID ?? "";

/** RFC 3986. encodeURIComponent 가 남기는 !*'() 까지 인코딩해야 서명이 맞는다. */
function enc(s: string): string {
  return encodeURIComponent(s).replace(/[!*'()]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}

/**
 * OAuth 1.0a Authorization 헤더를 만든다.
 *
 * JSON 본문은 서명에 들어가지 않는다 — 서명 대상은 쿼리 파라미터 + oauth_* 뿐이다.
 */
function authHeader(method: string, url: string, query: Record<string, string> = {}): string {
  const oauth: Record<string, string> = {
    oauth_consumer_key: CK(),
    oauth_nonce: randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: AT(),
    oauth_version: "1.0",
  };

  const all = { ...query, ...oauth };
  const paramString = Object.keys(all)
    .sort()
    .map((k) => `${enc(k)}=${enc(all[k]!)}`)
    .join("&");

  const base = [method.toUpperCase(), enc(url), enc(paramString)].join("&");
  const key = `${enc(CS())}&${enc(AS())}`;
  oauth.oauth_signature = createHmac("sha1", key).update(base).digest("base64");

  return (
    "OAuth " +
    Object.keys(oauth)
      .sort()
      .map((k) => `${enc(k)}="${enc(oauth[k]!)}"`)
      .join(", ")
  );
}

async function apiPost<T>(pathname: string, body: unknown): Promise<T> {
  const url = `${API}${pathname}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { authorization: authHeader("POST", url), "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`X ${pathname} 실패 (HTTP ${res.status}): ${(await res.text()).slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export const x: Channel = {
  name: "x",

  configured() {
    return Boolean(CK() && CS() && AT() && AS() && UID());
  },

  setupHint() {
    return (
      "X_API_KEY / X_API_SECRET / X_ACCESS_TOKEN / X_ACCESS_SECRET / X_USER_ID 가 없습니다.\n" +
      "1) developer.x.com 에서 앱 생성 (2026-02 부터 종량제 — 크레딧 충전 필요)\n" +
      "2) Keys and tokens → API Key/Secret, Access Token/Secret 발급 (권한: Read and write)\n" +
      "3) 봇 계정의 숫자 user id 확인\n" +
      "4) .env.local 에 추가: X_API_KEY=... X_API_SECRET=... X_ACCESS_TOKEN=... X_ACCESS_SECRET=... X_USER_ID=...\n" +
      "5) npm run bot:social 재실행\n" +
      "주의: 링크가 붙은 게시물은 건당 $0.20 입니다. SOCIAL_MONTHLY_USD_CAP 로 상한을 두세요."
    );
  },

  async fetchMentions(sinceId?: string) {
    const url = `${API}/users/${encodeURIComponent(UID())}/mentions`;
    const query: Record<string, string> = { max_results: "10" };
    if (sinceId) query.since_id = sinceId;
    const qs = new URLSearchParams(query).toString();

    const res = await fetch(`${url}?${qs}`, {
      headers: { authorization: authHeader("GET", url, query) },
    });
    if (!res.ok) {
      throw new Error(`X mentions 실패 (HTTP ${res.status}): ${(await res.text()).slice(0, 200)}`);
    }
    const json = (await res.json()) as { data?: { id: string; text: string; author_id?: string }[] };
    return (json.data ?? []).map((d) => ({
      id: d.id,
      text: d.text,
      author: d.author_id ?? "unknown",
      permalink: `https://x.com/i/status/${d.id}`,
    })) satisfies Mention[];
  },

  async reply(mention: Mention, text: string, opts: SendOpts = {}) {
    await apiPost("/tweets", {
      text: opts.link ? `${text}\n${opts.link}` : text,
      reply: { in_reply_to_tweet_id: mention.id },
    });
  },

  async post(text: string, opts: SendOpts = {}) {
    await apiPost("/tweets", { text: opts.link ? `${text}\n${opts.link}` : text });
  },
};
