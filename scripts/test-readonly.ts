// G3 — 읽기 전용 파일시스템. 조용히 사라지면 안 된다.
// 실제로 권한을 막은 디렉토리에 써보고 확인한다 (모킹 아님).
import "../lib/env";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

async function main() {
  const { writeJson, readJson, isWritable, resetWritableCache, ReadOnlyStorageError } = await import("../lib/storage");

  let fail = 0;
  const t = (n: string, ok: boolean, x = "") => { if (!ok) fail++; console.log(`  ${ok ? "✓" : "✗"} ${n}${x ? "  " + x : ""}`); };

  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "ro-test-"));
  const roDir = path.join(tmp, "locked");
  await fs.mkdir(roDir);

  console.log("정상 디렉토리");
  const okFile = path.join(tmp, "ok.json");
  await writeJson(okFile, { a: 1 });
  t("쓰기 성공", (await readJson(okFile, null as unknown)) !== null);
  t("읽기 왕복", JSON.stringify(await readJson(okFile, {})) === JSON.stringify({ a: 1 }));
  t("없는 파일은 fallback", (await readJson(path.join(tmp, "nope.json"), "FB")) === "FB");
  t("깨진 JSON 도 fallback", await (async () => { const b = path.join(tmp, "bad.json"); await fs.writeFile(b, "{{{"); return (await readJson(b, "FB")) === "FB"; })());

  console.log("\n읽기 전용 디렉토리 (chmod 0o500)");
  await fs.chmod(roDir, 0o500); // r-x — 쓰기 불가
  const roFile = path.join(roDir, "blocked.json");

  let caught: unknown = null;
  try {
    await writeJson(roFile, { a: 1 });
  } catch (e) { caught = e; }

  t("쓰기가 조용히 성공하지 않음", caught !== null);
  t("ReadOnlyStorageError 로 정규화됨", caught instanceof ReadOnlyStorageError, caught instanceof Error ? caught.name : String(caught));
  t("메시지가 원인을 설명함", caught instanceof Error && caught.message.includes("읽기 전용"));
  t("메시지가 해결책을 안내함", caught instanceof Error && caught.message.includes("셀프호스트"));
  t("원본 오류를 cause 로 보존", caught instanceof Error && caught.cause !== undefined);
  t("파일이 실제로 안 만들어짐", await fs.access(roFile).then(() => false).catch(() => true));

  console.log("\nisWritable 판정");
  resetWritableCache();
  t("정상 디렉토리 → true", (await isWritable(tmp)) === true);
  resetWritableCache();
  t("읽기전용 디렉토리 → false", (await isWritable(roDir)) === false);
  resetWritableCache();
  t("탐침 파일이 남지 않음", !(await fs.readdir(tmp)).includes(".write-probe"));

  console.log("\n실제 앱 경로에서도 에러가 전파되는가");
  // users.ts 는 키를 다루므로 조용한 실패가 가장 위험하다
  process.env.USER_ENCRYPTION_KEY = "e".repeat(64);
  const origCwd = process.cwd();
  try {
    process.chdir(roDir); // data/ 를 만들 수 없는 위치
    const U = await import("../lib/users");
    const err = await U.ensureAgentWallet("__ro_test").then(() => null).catch((e) => e);
    t("유저 지갑 저장 실패가 던져짐 (조용히 유실 안 됨)", err !== null, err instanceof Error ? err.name : "");
  } finally {
    process.chdir(origCwd);
  }

  await fs.chmod(roDir, 0o700);
  await fs.rm(tmp, { recursive: true, force: true });

  console.log(fail === 0 ? "\nREADONLY OK — 조용한 유실 없음" : `\nREADONLY FAIL — ${fail}건`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error("READONLY FAIL —", e instanceof Error ? e.message : e); process.exit(1); });
