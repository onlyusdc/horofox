// 파일 저장 — 읽기 전용 환경(서버리스)에서 **조용히 실패하지 않게** 하는 얇은 층.
//
// 왜 필요한가: Vercel·Cloudflare 같은 환경은 파일시스템이 읽기 전용이거나 휘발성이다.
// 그냥 `fs.writeFile` 을 쓰면 예외가 나거나, 나더라도 상위에서 삼켜져
// "저장된 줄 알았는데 사라진" 상태가 된다. 페이퍼 원장이면 몰라도
// 유저 지갑 키가 그러면 치명적이다.
//
// 그래서 쓰기 실패를 **한 종류의 에러로 정규화**하고, 상위가 그걸 사용자에게
// 보여줄 수 있게 한다.

import fs from "node:fs/promises";
import path from "node:path";

/** 저장소가 쓰기 불가일 때 던진다. 상위는 이걸 잡아서 사용자에게 알려야 한다. */
export class ReadOnlyStorageError extends Error {
  constructor(target: string, cause?: unknown) {
    super(
      `저장할 수 없습니다 (${target}). 이 환경은 파일시스템이 읽기 전용입니다 — ` +
        `배포된 데모에서는 거래 기록·유저 정보가 저장되지 않습니다. ` +
        `실제 운용은 셀프호스트(도커/VM)로 하세요.`,
    );
    this.name = "ReadOnlyStorageError";
    this.cause = cause;
  }
}

/** 쓰기 불가를 뜻하는 errno 들. */
const READONLY_CODES = new Set(["EROFS", "EACCES", "EPERM", "ENOSPC"]);

function isReadOnly(e: unknown): boolean {
  const code = (e as { code?: string })?.code;
  return code !== undefined && READONLY_CODES.has(code);
}

/** JSON 을 읽는다. 없거나 깨졌으면 fallback. 읽기는 실패해도 조용해도 된다. */
export async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

/**
 * JSON 을 쓴다. 읽기 전용이면 `ReadOnlyStorageError` 를 던진다 — 삼키지 않는다.
 * 다른 오류는 원본 그대로 올린다 (디버깅에 필요하다).
 */
export async function writeJson(file: string, data: unknown): Promise<void> {
  try {
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(data, null, 2) + "\n", "utf8");
  } catch (e) {
    if (isReadOnly(e)) throw new ReadOnlyStorageError(path.basename(file), e);
    throw e;
  }
}

/** 지금 이 환경에서 쓰기가 되는가. 시작 시 한 번 확인해 배너를 띄우는 용도. */
let cached: boolean | null = null;

export async function isWritable(dir = path.join(process.cwd(), "data")): Promise<boolean> {
  if (cached !== null) return cached;
  const probe = path.join(dir, ".write-probe");
  try {
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(probe, "x", "utf8");
    await fs.unlink(probe).catch(() => {});
    cached = true;
  } catch {
    cached = false;
  }
  return cached;
}

/** 테스트용 — 캐시 초기화. */
export function resetWritableCache(): void {
  cached = null;
}
