// 요청 → 신원.
//
// 규칙 하나: **클라이언트가 보낸 문자열을 그대로 userId 로 쓰지 않는다.**
// 그렇게 하면 헤더 하나 바꿔서 남의 계정으로 거래할 수 있다.
//
// 신원은 서버가 아는 비밀(API 키)에서만 나온다. 키 → userId 매핑은 서버가 갖고,
// 클라이언트는 키만 제시한다. 키를 모르면 그 유저가 될 수 없다.

import { createHash, timingSafeEqual } from "node:crypto";

/** 이 요청이 누구인가. null 이면 익명(= 운영자 컨텍스트도 아님). */
export type Identity = { userId: string; scope: "user" } | { userId: null; scope: "operator" } | null;

/**
 * 유저 API 키 목록. `USER_API_KEYS="alice:key1,bob:key2"` 형태.
 * 키는 서버만 알고, userId 는 서버가 붙인다.
 */
function userKeyMap(): Map<string, string> {
  const raw = process.env.USER_API_KEYS ?? "";
  const m = new Map<string, string>();
  for (const pair of raw.split(",")) {
    const [id, key] = pair.split(":").map((x) => x?.trim());
    if (!id || !key) continue;
    // 키 → userId (조회는 키로 한다)
    m.set(sha256(key), id);
  }
  return m;
}

function sha256(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

/** 길이 노출 없이 비교. 문자열 비교는 조기 종료라 타이밍이 샌다. */
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(sha256(a), "hex");
  const bb = Buffer.from(sha256(b), "hex");
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

function bearer(req: Request): string | null {
  const h = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m ? m[1]!.trim() : null;
}

/**
 * 요청의 신원을 판정한다.
 *
 * - 유저 키가 맞으면 → 그 유저 (서버가 매핑한 userId)
 * - 운영자 키(AGENT_API_KEY)가 맞으면 → 운영자 (userId 없음)
 * - AGENT_API_KEY 미설정 = 로컬 개발 → 운영자로 본다
 * - 그 외 → null (거부)
 *
 * **`X-User-Id` 같은 헤더는 절대 읽지 않는다.** 신원은 비밀에서만 나온다.
 */
export function identify(req: Request): Identity {
  const token = bearer(req);
  const users = userKeyMap();

  if (token) {
    const uid = users.get(sha256(token));
    if (uid) return { userId: uid, scope: "user" };
  }

  const operatorKey = process.env.AGENT_API_KEY;
  if (!operatorKey) {
    // 로컬 개발 기본값. 운영에서는 AGENT_API_KEY 를 반드시 설정할 것.
    return { userId: null, scope: "operator" };
  }
  if (token && safeEqual(token, operatorKey)) return { userId: null, scope: "operator" };

  return null;
}

/** perps 함수에 넘길 컨텍스트. 운영자는 undefined (기존 동작 유지). */
export function tradeContextOf(id: Identity): { userId: string } | undefined {
  return id && id.scope === "user" ? { userId: id.userId } : undefined;
}

/** 공개 배포에서 운영자 키 없이 열려 있으면 위험하다 — 경고 문자열. */
export function authWarning(): string | null {
  if (process.env.AGENT_API_KEY) return null;
  if (process.env.NODE_ENV !== "production") return null;
  return "AGENT_API_KEY 가 없습니다. 운영 환경에서 API 가 인증 없이 열려 있습니다.";
}
