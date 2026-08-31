// G4 — 구독(사용량 한도). Bankr 의 "무료 N회 → 결제로 해제" 를 x402 로.
import "../lib/env";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

async function main() {
  let fail = 0;
  const t = (n: string, ok: boolean, x = "") => { if (!ok) fail++; console.log(`  ${ok ? "✓" : "✗"} ${n}${x ? "  " + x : ""}`); };

  // 격리된 작업 디렉토리에서 돌린다 (실제 data/ 를 건드리지 않게)
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "quota-"));
  const orig = process.cwd();
  process.chdir(tmp);
  process.env.FREE_CALLS_PER_DAY = "3";
  process.env.CALLS_PER_PAYMENT = "10";

  try {
    const Q = await import("../lib/quota");
    const S = "ip:1.2.3.4";
    const DAY1 = Date.UTC(2026, 0, 1, 12);
    const DAY2 = Date.UTC(2026, 0, 2, 12);

    console.log(`무료 한도 ${Q.FREE_CALLS_PER_DAY}회 / 결제당 ${Q.CALLS_PER_PAYMENT}회`);

    console.log("\n무료 소진");
    let st = await Q.peek(S, DAY1);
    t("처음엔 전량 남음", st.remaining === 3 && st.allowed);
    for (let i = 1; i <= 3; i++) st = await Q.consume(S, DAY1);
    t("3회 쓰면 소진", st.used === 3 && st.remaining === 0);
    st = await Q.consume(S, DAY1);
    t("4회째는 차단", st.allowed === false);
    t("차단 시 사용량이 더 늘지 않음", st.used === 3, `used=${st.used}`);

    console.log("\n결제로 해제");
    st = await Q.grantCredits(S, 10, DAY1);
    t("크레딧 부여", st.credits === 10 && st.allowed);
    st = await Q.consume(S, DAY1);
    t("크레딧을 먼저 소모 (무료는 이미 0)", st.credits === 9);
    t("무료 사용량은 그대로", st.used === 3);

    console.log("\n날짜가 바뀌면");
    st = await Q.peek(S, DAY2);
    t("무료분 초기화", st.used === 0);
    t("산 크레딧은 이월 (뺏지 않는다)", st.credits === 9, `credits=${st.credits}`);
    t("총 잔여 = 무료 + 크레딧", st.remaining === 3 + 9);

    console.log("\n주체 분리");
    const other = await Q.peek("ip:9.9.9.9", DAY1);
    t("다른 IP 는 독립적", other.used === 0 && other.credits === 0);
    const req = new Request("http://x/", { headers: { "cf-connecting-ip": "5.6.7.8" } });
    t("subjectOf: CF 헤더 사용", Q.subjectOf(req) === "ip:5.6.7.8");
    t("subjectOf: 인증 유저 우선", Q.subjectOf(req, "alice") === "user:alice");

    console.log("\n방어");
    t("음수 크레딧 거부", await Q.grantCredits(S, -1, DAY1).then(() => false).catch(() => true));
    t("0 크레딧 거부", await Q.grantCredits(S, 0, DAY1).then(() => false).catch(() => true));

    console.log("\n읽기 전용 환경 (공개 데모)");
    // QUOTA_PATH 는 모듈 로드 시점 cwd 로 고정된다 (프로덕션에선 cwd 가 안 바뀌므로 정상).
    // 그래서 chdir 이 아니라 **실제 data 디렉토리 권한**을 막아야 이 경로를 탄다.
    // 파일이 이미 있으면 디렉토리 권한과 무관하게 쓰기가 된다 (권한은 파일에 붙는다).
    // 그래서 quota.json 자체를 읽기 전용으로 만든다.
    const quotaFile = path.join(tmp, "data", "quota.json");
    await fs.chmod(quotaFile, 0o400);
    const roSt = await Q.consume("ip:ro-test", DAY1);
    t("저장 불가여도 방문자를 막지 않음", roSt.allowed === true);
    t("degraded 로 표시해 숨기지 않음", roSt.degraded === true);
    await fs.chmod(quotaFile, 0o600);

    console.log(fail === 0 ? "\nSUBSCRIPTION OK — 한도·결제·이월 동작" : `\nSUBSCRIPTION FAIL — ${fail}건`);
  } finally {
    process.chdir(orig);
    await fs.rm(tmp, { recursive: true, force: true });
  }
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error("SUBSCRIPTION FAIL —", e instanceof Error ? e.message : e); process.exit(1); });
