// 유저 저장소 — 유저별 Hyperliquid agent(API) 지갑.
//
// 왜 agent wallet 인가: HL 의 agent 지갑은 **주문만 가능하고 출금 권한이 구조적으로 없다.**
// 서버가 털려도 자금이 빠져나가지 않는다. 유저 자산은 유저 메인 지갑에 그대로 있다.
//
// 개인키는 AES-256-GCM 으로만 저장한다. 평문 저장 경로는 존재하지 않는다 —
// `setAgentKey` 가 유일한 쓰기 경로이고 반드시 암호화를 거친다.

import fs from "node:fs/promises";
import path from "node:path";
import { writeJson } from "./storage";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const USERS_PATH = path.join(process.cwd(), "data", "users.json");

export interface UserRecord {
  /** 채널 무관 유저 식별자 (텔레그램 chat id, API 키 해시 등). */
  id: string;
  /** 유저의 메인 지갑 — 자산이 있는 곳. 포지션 조회에 쓴다. */
  mainAddress: `0x${string}` | null;
  /** 우리가 만든 agent 지갑 주소. 유저가 HL 앱에서 이걸 승인해야 주문이 나간다. */
  agentAddress: `0x${string}` | null;
  /** AES-256-GCM 암호문 (iv:ciphertext+tag, hex). 평문은 저장하지 않는다. */
  agentKeyEnc: string | null;
  /** 유저가 HL 에서 agent 를 승인했는지 (우리가 확인한 시점 기준). */
  agentApproved: boolean;
  /** 유저가 승인한 builder 최대 요율(%). null 이면 미승인. */
  feeApprovedPercent: number | null;
  createdAt: string;
}

interface UsersFile {
  users: Record<string, UserRecord>;
}

// ───────────────────────── 암호화 ─────────────────────────

function keyBytes(): Buffer {
  const hex = process.env.USER_ENCRYPTION_KEY ?? "";
  if (!hex) {
    throw new Error(
      "USER_ENCRYPTION_KEY 가 없습니다. agent 개인키를 평문으로 저장하지 않습니다.\n" +
        "생성: openssl rand -hex 32",
    );
  }
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("USER_ENCRYPTION_KEY 는 hex 64자(32바이트)여야 합니다.");
  }
  return Buffer.from(hex, "hex");
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", keyBytes(), iv);
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `${iv.toString("hex")}:${Buffer.concat([body, c.getAuthTag()]).toString("hex")}`;
}

export function decrypt(blob: string): string {
  const [ivHex, dataHex] = blob.split(":");
  if (!ivHex || !dataHex) throw new Error("암호문 형식이 잘못됐습니다.");
  const data = Buffer.from(dataHex, "hex");
  if (data.length < 17) throw new Error("암호문이 너무 짧습니다 (태그 누락).");
  const tag = data.subarray(data.length - 16);
  const body = data.subarray(0, data.length - 16);
  const d = createDecipheriv("aes-256-gcm", keyBytes(), Buffer.from(ivHex, "hex"));
  d.setAuthTag(tag);
  return Buffer.concat([d.update(body), d.final()]).toString("utf8");
}

// ───────────────────────── 저장소 ─────────────────────────

async function read(): Promise<UsersFile> {
  try {
    return JSON.parse(await fs.readFile(USERS_PATH, "utf8")) as UsersFile;
  } catch {
    return { users: {} };
  }
}

async function write(f: UsersFile): Promise<void> {
  await writeJson(USERS_PATH, f);
}

function blank(id: string): UserRecord {
  return {
    id,
    mainAddress: null,
    agentAddress: null,
    agentKeyEnc: null,
    agentApproved: false,
    feeApprovedPercent: null,
    createdAt: new Date().toISOString(),
  };
}

export async function getUser(id: string): Promise<UserRecord | null> {
  return (await read()).users[id] ?? null;
}

export async function listUsers(): Promise<UserRecord[]> {
  return Object.values((await read()).users);
}

/**
 * 유저 레코드 갱신.
 *
 * `agentKeyEnc` 는 **타입으로 막아둔다** — 호출자가 여기에 평문 키를 넣을 수 있으면
 * "평문 저장 경로 없음" 이 거짓이 된다. 키를 쓰는 유일한 경로는 `setAgentKey` 다.
 */
export type UserPatch = Omit<Partial<UserRecord>, "agentKeyEnc" | "id">;

export async function upsertUser(id: string, patch: UserPatch): Promise<UserRecord> {
  const f = await read();
  // 혹시 런타임에 섞여 들어와도 버린다 (JS 호출자는 타입을 우회할 수 있다)
  const { agentKeyEnc: _drop, ...safe } = patch as UserPatch & { agentKeyEnc?: unknown };
  void _drop;
  const next: UserRecord = { ...blank(id), ...f.users[id], ...safe, id };
  f.users[id] = next;
  await write(f);
  return next;
}

/**
 * agent 개인키를 저장한다. **암호화를 거치는 유일한 쓰기 경로.**
 * 평문이 파일에 닿을 방법이 여기 말고는 없다.
 */
export async function setAgentKey(id: string, privateKey: `0x${string}`): Promise<UserRecord> {
  if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new Error("개인키 형식이 잘못됐습니다 (0x + 64 hex).");
  }
  const f = await read();
  const next: UserRecord = {
    ...blank(id),
    ...f.users[id],
    id,
    agentAddress: privateKeyToAccount(privateKey).address,
    agentKeyEnc: encrypt(privateKey),
  };
  f.users[id] = next;
  await write(f);
  return next;
}

/**
 * 유저의 agent 지갑을 만든다 (없을 때만). 개인키는 암호화해서 저장한다.
 * 이 키는 주문만 가능하고 출금 권한이 없다.
 */
export async function ensureAgentWallet(id: string): Promise<UserRecord> {
  const existing = await getUser(id);
  if (existing?.agentKeyEnc && existing.agentAddress) return existing;
  return setAgentKey(id, generatePrivateKey());
}

/** 복호화된 개인키. 호출 즉시 쓰고 버릴 것 — 로그에 남기지 말 것. */
export async function agentKeyOf(id: string): Promise<`0x${string}` | null> {
  const u = await getUser(id);
  return u?.agentKeyEnc ? (decrypt(u.agentKeyEnc) as `0x${string}`) : null;
}

/** 저장소에 평문 개인키가 섞여 들어갔는지 감사한다. 0이어야 정상. */
export async function auditPlaintextKeys(): Promise<number> {
  const raw = await fs.readFile(USERS_PATH, "utf8").catch(() => "");
  // 0x + 64 hex 가 통째로 보이면 평문 키가 샌 것이다 (암호문은 iv:hex 형태라 콜론이 있다)
  const hits = raw.match(/"0x[0-9a-fA-F]{64}"/g) ?? [];
  return hits.length;
}

export async function deleteUser(id: string): Promise<void> {
  const f = await read();
  delete f.users[id];
  await write(f);
}
