// G2 — 지출 상한. X 는 종량제라 이게 새면 실제로 돈이 나간다.
import "../lib/env";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

async function main() {
  let fail = 0;
  const t = (n: string, ok: boolean, x = "") => { if (!ok) fail++; console.log(`  ${ok ? "✓" : "✗"} ${n}${x ? "  " + x : ""}`); };

  const orig = process.cwd();
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "budget-"));
  process.chdir(tmp);
  await fs.mkdir("data", { recursive: true });
  process.env.SOCIAL_MONTHLY_USD_CAP = "1";

  try {
    const B = await import("../lib/social/budget");
    console.log(`상한 $${B.MONTHLY_USD_CAP}/월`);

    console.log("\n요금표 — X 는 링크가 13배다");
    t("X 읽기 $0.005", B.costOf("x", "read") === 0.005);
    t("X 게시 $0.015", B.costOf("x", "post") === 0.015);
    t("X 링크 게시 $0.20", B.costOf("x", "postWithLink") === 0.2);
    t("링크가 게시의 13배 이상", B.costOf("x", "postWithLink") / B.costOf("x", "post") > 13);
    t("Farcaster 는 전부 0", (["read", "post", "postWithLink"] as const).every((a) => B.costOf("farcaster", a) === 0));

    console.log("\n무료 채널은 상한과 무관");
    t("Farcaster 는 항상 허용", await B.canSpend("farcaster", "postWithLink"));
    for (let i = 0; i < 50; i++) await B.spend("farcaster", "postWithLink");
    const fc = await B.peekBudget("farcaster");
    t("50회 게시해도 지출 0", fc.spentUsd === 0, `$${fc.spentUsd}`);
    t("건수는 기록됨", fc.counts.postWithLink === 50, `${fc.counts.postWithLink}건`);

    console.log("\n상한 강제 — $1 로 링크 게시를 몇 번 할 수 있나");
    let ok = 0, denied = 0;
    for (let i = 0; i < 10; i++) {
      const r = await B.spend("x", "postWithLink");
      r.allowed ? ok++ : denied++;
    }
    // $0.20 × 5 = $1.00 이 딱 상한
    t("정확히 5회만 통과", ok === 5, `허용 ${ok} / 거부 ${denied}`);
    const xs = await B.peekBudget("x");
    t("지출이 상한을 넘지 않음", xs.spentUsd <= 1 + 1e-9, `$${xs.spentUsd}`);
    t("잔여 0", xs.remainingUsd === 0, `$${xs.remainingUsd}`);
    t("거부 사유를 설명", ((await B.spend("x", "postWithLink")).reason ?? "").includes("상한"));
    t("초과 후 canSpend=false", !(await B.canSpend("x", "postWithLink")));
    t("더 싼 행동도 상한 넘으면 거부", !(await B.canSpend("x", "read")));

    console.log("\n동시 호출 — 같은 잔액을 보고 둘 다 통과하면 안 된다");
    // 새 원장에서 시작한다. 앞 단계의 지출이 남아 있으면 이 검사가 의미를 잃는다.
    const tmp2 = await fs.mkdtemp(path.join(os.tmpdir(), "budget2-"));
    process.chdir(tmp2);
    await fs.mkdir("data", { recursive: true });
    t("새 원장은 지출 0 에서 시작", (await B.peekBudget("x")).spentUsd === 0);
    const results = await Promise.all(Array.from({ length: 10 }, () => B.spend("x", "postWithLink")));
    const allowed = results.filter((r) => r.allowed).length;
    const st = await B.peekBudget("x");
    t("동시 10건 중 5건만 허용", allowed === 5, `${allowed}건`);
    t("동시 실행에도 상한 유지", st.spentUsd <= 1 + 1e-9, `$${st.spentUsd}`);

    console.log("\n읽기 전용 파일시스템 — 기록 못 하면 돈을 쓰면 안 된다");
    const ro = await fs.mkdtemp(path.join(os.tmpdir(), "budget-ro-"));
    process.chdir(ro);
    await fs.mkdir("data", { recursive: true });
    // 원장 파일이 없는 디렉터리다. 여기서 지출이 0 이 아니면 메모리에 상태가 새고 있다는 뜻이다.
    t("원장 없는 곳에서 지출이 새지 않음", (await B.peekBudget("x")).spentUsd === 0, `$${(await B.peekBudget("x")).spentUsd}`);
    await fs.chmod("data", 0o500);
    const rx = await B.spend("x", "post");
    t("유료 채널은 거부", !rx.allowed, rx.reason?.slice(0, 44) ?? "");
    t("거부 사유가 상한이 아니라 기록 실패", (rx.reason ?? "").includes("기록"), rx.reason?.slice(0, 44) ?? "");
    const rf = await B.spend("farcaster", "post");
    t("무료 채널은 통과 (손해가 없으므로)", rf.allowed);
    await fs.chmod("data", 0o700);

    console.log(fail === 0 ? "\nBUDGET OK — 상한이 코드로 강제됨" : `\nBUDGET FAIL — ${fail}건`);
  } finally {
    process.chdir(orig);
    await fs.rm(tmp, { recursive: true, force: true });
  }
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error("BUDGET FAIL —", e instanceof Error ? e.message : e); process.exit(1); });
