// G2 — 테스트넷 서명이 메인넷과 분리되는가. 체인을 섞으면 주문이 엉뚱한 망으로 간다.
import "../lib/env";
const TB = "0x1111111111111111111111111111111111111111";
process.env.HL_BUILDER_ADDRESS = TB;

async function main() {
  const { privateKeyToAccount } = await import("viem/accounts");
  const signing = await import("@nktkas/hyperliquid/signing");
  const hl = await import("@nktkas/hyperliquid");

  let fail = 0;
  const t = (n: string, ok: boolean, x = "") => { if (!ok) fail++; console.log(`  ${ok ? "✓" : "✗"} ${n}${x ? "  " + x : ""}`); };

  const account = privateKeyToAccount(("0x" + "22".repeat(32)) as `0x${string}`);
  const nonce = 1735689600000;

  // 테스트넷 자산 메타로 주문을 만든다 (메인넷과 universe 가 다르다)
  const info = new hl.InfoClient({ transport: new hl.HttpTransport({ isTestnet: true }) });
  const meta = await info.meta();
  const ethIdx = meta.universe.findIndex((u) => u.name === "ETH");
  t("테스트넷 meta 로드", meta.universe.length > 5, `${meta.universe.length}종`);
  t("테스트넷에 ETH 존재", ethIdx >= 0, `index=${ethIdx}`);

  const action = {
    orders: [{ a: ethIdx, b: true, p: "2000", s: "0.01", r: false, t: { limit: { tif: "Ioc" as const } } }],
    grouping: "na" as const,
    builder: { b: TB as `0x${string}`, f: 100 },
  };

  const sigTest = await signing.signL1Action({ wallet: account, action: action as never, nonce, isTestnet: true });
  const sigMain = await signing.signL1Action({ wallet: account, action: action as never, nonce, isTestnet: false });

  console.log(`\n  테스트넷 서명 r=${sigTest.r.slice(0, 20)}…`);
  console.log(`  메인넷   서명 r=${sigMain.r.slice(0, 20)}…\n`);

  t("테스트넷 서명 형식 유효", /^0x[0-9a-f]{64}$/i.test(sigTest.r) && (sigTest.v === 27 || sigTest.v === 28));
  t("메인넷 서명 형식 유효", /^0x[0-9a-f]{64}$/i.test(sigMain.r));
  t("테스트넷 ≠ 메인넷 서명 → 체인 분리됨", sigTest.r !== sigMain.r || sigTest.s !== sigMain.s);
  t("builder 가 테스트넷 주문에도 포함", action.builder.b === TB && action.builder.f === 100);

  // builder 변조 시 서명 변화 (서명 대상 포함 확인)
  const tampered = { ...action, builder: { b: "0x3333333333333333333333333333333333333333" as `0x${string}`, f: 100 } };
  const sigTamper = await signing.signL1Action({ wallet: account, action: tampered as never, nonce, isTestnet: true });
  t("builder 변조 → 서명 달라짐", sigTest.r !== sigTamper.r || sigTest.s !== sigTamper.s);

  // 같은 입력 → 같은 서명
  const again = await signing.signL1Action({ wallet: account, action: action as never, nonce, isTestnet: true });
  t("결정론적 서명", sigTest.r === again.r && sigTest.s === again.s);

  console.log(fail === 0 ? "\nTESTNET-SIGN OK — 체인 분리 확인" : `\nTESTNET-SIGN FAIL — ${fail}건`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error("TESTNET-SIGN FAIL —", e instanceof Error ? e.message : e); process.exit(1); });
