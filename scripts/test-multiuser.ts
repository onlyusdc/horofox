// G5 — 멀티유저. 서로 다른 유저가 각자의 지갑으로 서명하되, 수수료는 전부 나에게 온다.
import "../lib/env";
const BUILDER = "0x1111111111111111111111111111111111111111";
process.env.USER_ENCRYPTION_KEY = "b".repeat(64);
process.env.HL_BUILDER_ADDRESS = BUILDER;
process.env.HL_MODE = "live";
process.env.HL_TRADER_KEY = "0x" + "11".repeat(32);

async function main() {
  const U = await import("../lib/users");
  const { buildOnly } = await import("../lib/hl/trade");
  const { openPerp, closePerp, getPerpPositions } = await import("../lib/perps");
  const { privateKeyToAccount } = await import("viem/accounts");
  const signing = await import("@nktkas/hyperliquid/signing");

  let fail = 0;
  const t = (n: string, ok: boolean, x = "") => { if (!ok) fail++; console.log(`  ${ok ? "✓" : "✗"} ${n}${x ? "  " + x : ""}`); };

  const A = "__mu_alice", B = "__mu_bob";
  for (const id of [A, B]) await U.deleteUser(id);

  console.log("유저 2명 온보딩");
  const ua = await U.ensureAgentWallet(A);
  const ub = await U.ensureAgentWallet(B);
  t("서로 다른 agent 지갑", ua.agentAddress !== ub.agentAddress);
  console.log(`    alice agent ${ua.agentAddress}`);
  console.log(`    bob   agent ${ub.agentAddress}`);

  console.log("\n미승인 유저는 거래 거부 (승인 없이 주문 나가면 HL 이 거부한다)");
  const notApproved = await openPerp("BTC", "long", 100, 2, { userId: A });
  t("승인 전 거부", notApproved.ok === false, "ok" in notApproved && !notApproved.ok ? notApproved.error.slice(0, 46) : "");

  const unknown = await openPerp("BTC", "long", 100, 2, { userId: "__ghost" });
  t("미등록 유저 거부", unknown.ok === false);

  console.log("\n승인 후 — 각자의 키로 서명되는가");
  await U.upsertUser(A, { agentApproved: true, mainAddress: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" });
  await U.upsertUser(B, { agentApproved: true, mainAddress: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" });

  const built = await buildOnly({ symbol: "BTC", side: "long", marginUsdc: 100, leverage: 2 });
  const nonce = 1735689600000;
  const sigOf = async (id: string) => {
    const k = (await U.agentKeyOf(id))!;
    return signing.signL1Action({
      wallet: privateKeyToAccount(k),
      action: built.action as unknown as Parameters<typeof signing.signL1Action>[0]["action"],
      nonce, isTestnet: false,
    });
  };
  const sa = await sigOf(A), sb = await sigOf(B);
  t("같은 주문이라도 유저마다 서명이 다름", sa.r !== sb.r || sa.s !== sb.s);
  t("alice 서명 형식 유효", /^0x[0-9a-f]{64}$/i.test(sa.r) && (sa.v === 27 || sa.v === 28));
  t("bob 서명 형식 유효", /^0x[0-9a-f]{64}$/i.test(sb.r) && (sb.v === 27 || sb.v === 28));

  console.log("\n두 유저의 주문에 모두 같은 내 builder code 가 붙는가 ← 매출의 핵심");
  t("주문에 builder 부착", built.action.builder.b === BUILDER && built.action.builder.f === 100,
    `${built.action.builder.b} f=${built.action.builder.f}`);
  const built2 = await buildOnly({ symbol: "SKHX", side: "short", marginUsdc: 200, leverage: 3 });
  t("다른 자산·다른 방향에서도 같은 builder", built2.action.builder.b === BUILDER && built2.action.builder.f === 100);

  console.log("\n조회는 각자의 메인 지갑 기준인가 (agent 는 서명만)");
  const posA = await getPerpPositions({ userId: A });
  t("alice 포지션 조회가 에러 없이 반환", Array.isArray(posA.positions));
  const noMain = "__mu_nomain";
  await U.deleteUser(noMain);
  await U.ensureAgentWallet(noMain);
  await U.upsertUser(noMain, { agentApproved: true }); // mainAddress 없음
  const posNo = await getPerpPositions({ userId: noMain });
  t("메인 지갑 미등록이면 명확히 안내", (posNo.note ?? "").includes("메인 지갑"), posNo.note);
  const closeNo = await closePerp("BTC", { userId: noMain });
  t("청산도 메인 지갑 없으면 거부", closeNo.ok === false);

  console.log("\n운영자 컨텍스트(기존 호출)는 그대로 동작하는가");
  const opPos = await getPerpPositions();
  t("ctx 없이 호출해도 동작 (하위호환)", typeof opPos === "object" && "positions" in opPos);

  for (const id of [A, B, noMain]) await U.deleteUser(id);

  console.log(fail === 0 ? "\nMULTIUSER OK — 각자 서명, 수수료는 하나로" : `\nMULTIUSER FAIL — ${fail}건`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error("MULTIUSER FAIL —", e instanceof Error ? e.message : e); process.exit(1); });
