// G4 — 유저 저장소. 개인키가 평문으로 새면 안 된다.
import "../lib/env";
process.env.USER_ENCRYPTION_KEY = "a".repeat(64);
process.env.HL_BUILDER_ADDRESS ||= "0x1111111111111111111111111111111111111111";

async function main() {
  const U = await import("../lib/users");
  const { privateKeyToAccount } = await import("viem/accounts");
  const fs = await import("node:fs/promises");

  let fail = 0;
  const t = (n: string, ok: boolean, x = "") => { if (!ok) fail++; console.log(`  ${ok ? "✓" : "✗"} ${n}${x ? "  " + x : ""}`); };
  const rejects = async (fn: () => Promise<unknown>) => { try { await fn(); return false; } catch { return true; } };

  const ID = "__test_user_1";
  const ID2 = "__test_user_2";
  await U.deleteUser(ID); await U.deleteUser(ID2);

  console.log("암호화 왕복");
  const secret = "0x" + "ab".repeat(32);
  const blob = U.encrypt(secret);
  t("암호문이 iv:ciphertext 형태", /^[0-9a-f]{24}:[0-9a-f]+$/.test(blob));
  t("암호문에 평문이 안 보임", !blob.includes(secret.slice(2)));
  t("복호화 왕복 일치", U.decrypt(blob) === secret);
  t("매번 다른 IV → 같은 평문도 다른 암호문", U.encrypt(secret) !== U.encrypt(secret));
  t("변조된 암호문은 복호화 실패 (GCM 인증)", (() => { const bad = blob.slice(0, -2) + (blob.slice(-2) === "00" ? "11" : "00"); try { U.decrypt(bad); return false; } catch { return true; } })());

  console.log("\n키 미설정 시 거부 — 평문 저장 경로가 없다");
  const saved = process.env.USER_ENCRYPTION_KEY;
  process.env.USER_ENCRYPTION_KEY = "";
  t("USER_ENCRYPTION_KEY 없으면 암호화 거부", (() => { try { U.encrypt("x"); return false; } catch { return true; } })());
  process.env.USER_ENCRYPTION_KEY = "short";
  t("길이 잘못된 키 거부", (() => { try { U.encrypt("x"); return false; } catch { return true; } })());
  process.env.USER_ENCRYPTION_KEY = saved;

  console.log("\nagent 지갑 생성");
  const u1 = await U.ensureAgentWallet(ID);
  t("agent 주소 생성", /^0x[0-9a-fA-F]{40}$/.test(u1.agentAddress ?? ""));
  t("개인키가 암호화 저장됨", (u1.agentKeyEnc ?? "").includes(":"));
  const k1 = await U.agentKeyOf(ID);
  t("복호화한 키가 주소와 일치", !!k1 && privateKeyToAccount(k1).address === u1.agentAddress);

  const u1again = await U.ensureAgentWallet(ID);
  t("두 번 불러도 같은 지갑 (덮어쓰지 않음)", u1again.agentAddress === u1.agentAddress);

  const u2 = await U.ensureAgentWallet(ID2);
  t("유저마다 다른 지갑", u2.agentAddress !== u1.agentAddress);

  console.log("\n저장 파일 감사 — 평문 개인키 0건이어야 한다");
  const plain = await U.auditPlaintextKeys();
  t("파일에 평문 0x+64hex 키 0건", plain === 0, `발견 ${plain}건`);
  const raw = await fs.readFile("data/users.json", "utf8");
  t("복호화한 키 문자열이 파일에 없음", !raw.includes(k1!.slice(2)));

  console.log("\n레코드 갱신");
  await U.upsertUser(ID, { mainAddress: "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef", agentApproved: true, feeApprovedPercent: 0.1 });
  const got = await U.getUser(ID);
  t("mainAddress 저장", got?.mainAddress === "0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef");
  t("승인 플래그 저장", got?.agentApproved === true);
  t("agent 키가 갱신에도 보존됨", got?.agentKeyEnc === u1.agentKeyEnc);
  t("없는 유저는 null", (await U.getUser("__nope")) === null);

  console.log("\n평문 주입 시도 — 타입을 우회해도 막혀야 한다");
  const PLAIN = "0x" + "cd".repeat(32);
  await U.ensureAgentWallet(ID);
  const before = (await U.getUser(ID))!.agentKeyEnc;
  // JS 호출자는 TS 타입을 우회할 수 있다 → 런타임에서도 버리는지 확인
  await (U.upsertUser as unknown as (i: string, p: Record<string, unknown>) => Promise<unknown>)(ID, { agentKeyEnc: PLAIN, agentApproved: true });
  const after = (await U.getUser(ID))!;
  t("upsertUser 가 평문 키를 무시함", after.agentKeyEnc === before, `${String(after.agentKeyEnc).slice(0, 20)}…`);
  t("무시하면서 다른 필드는 반영됨", after.agentApproved === true);
  t("파일에 주입 평문이 없음", !(await fs.readFile("data/users.json", "utf8")).includes(PLAIN.slice(2)));
  t("감사 함수도 0건", (await U.auditPlaintextKeys()) === 0);

  console.log("\nsetAgentKey — 유일한 키 쓰기 경로");
  const fresh = "0x" + "ef".repeat(32);
  const rec = await U.setAgentKey(ID, fresh as `0x${string}`);
  t("주소가 키에서 유도됨", rec.agentAddress === privateKeyToAccount(fresh as `0x${string}`).address);
  t("저장은 암호문", (rec.agentKeyEnc ?? "").includes(":") && !rec.agentKeyEnc!.includes(fresh.slice(2)));
  t("복호화 왕복", (await U.agentKeyOf(ID)) === fresh);
  t("형식 틀린 키 거부", await U.setAgentKey(ID, "0xshort" as `0x${string}`).then(() => false).catch(() => true));

  await U.deleteUser(ID); await U.deleteUser(ID2);
  t("삭제됨", (await U.getUser(ID)) === null);

  console.log(fail === 0 ? "\nUSERS OK — 평문 저장 경로 없음" : `\nUSERS FAIL — ${fail}건`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error("USERS FAIL —", e instanceof Error ? e.message : e); process.exit(1); });
