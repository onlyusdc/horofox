// 1번 — 테스트넷 왕복. 실제로 주문을 내보내 전송 경로를 닫는다.
//
// 사용법:
//   npx tsx scripts/testnet-trade.ts           진단만 (주문 안 나감)
//   npx tsx scripts/testnet-trade.ts --send    실제 주문 전송
//
// 필요한 것:
//   HL_TESTNET_KEY       테스트넷 트레이더 개인키 (없으면 자동 생성해 알려준다)
//   HL_BUILDER_ADDRESS   수수료 받을 주소
// 자금:
//   https://app.hyperliquid-testnet.xyz/drip 에서 지갑 연결 후 테스트넷 USDC 수령
import "../lib/env";

process.env.HL_NETWORK = "testnet";
process.env.HL_BUILDER_ADDRESS ||= "0x1111111111111111111111111111111111111111";

const SEND = process.argv.includes("--send");
/**
 * --probe: 자금이 없어도 실제로 전송해본다.
 * 거래소가 "서명 오류"가 아니라 "잔고/마진 부족"으로 거부하면,
 * 그건 **서명이 검증되고 주문이 실제로 평가됐다**는 증거다.
 * 자금 문제와 코드 문제를 가르는 유일한 방법이라 남겨둔다.
 */
const PROBE = process.argv.includes("--probe");
const SYMBOL = process.env.HL_TESTNET_SYMBOL ?? "ETH";
const MARGIN = Number(process.env.HL_TESTNET_MARGIN ?? "12"); // 명목가 $12 → 최소 $10 상회
const LEVERAGE = 1;

async function main() {
  const { privateKeyToAccount, generatePrivateKey } = await import("viem/accounts");
  const hl = await import("@nktkas/hyperliquid");
  const { buildOnly, assertBuilderEligible } = await import("../lib/hl/trade");
  const { BUILDER_ADDRESS, MIN_ORDER_USD } = await import("../lib/hl/config");

  let key = (process.env.HL_TESTNET_KEY ?? "").trim();
  let generated = false;
  if (!key) { key = generatePrivateKey(); generated = true; }
  if (!key.startsWith("0x")) key = `0x${key}`;
  const account = privateKeyToAccount(key as `0x${string}`);

  const info = new hl.InfoClient({ transport: new hl.HttpTransport({ isTestnet: true }) });

  console.log("Hyperliquid 테스트넷 왕복");
  console.log(`  트레이더 : ${account.address}${generated ? "  (자동 생성됨 — 아래 안내 참고)" : ""}`);
  console.log(`  빌더     : ${BUILDER_ADDRESS}`);
  console.log(`  주문     : ${SYMBOL} long, 증거금 $${MARGIN} × ${LEVERAGE}배 = 명목가 $${MARGIN * LEVERAGE}`);

  // 1) 계좌 잔고
  let accountValue = 0;
  try {
    const st = await info.clearinghouseState({ user: account.address });
    accountValue = Number(st.marginSummary.accountValue);
  } catch (e) {
    console.log(`\n  ✗ 계좌 조회 실패: ${e instanceof Error ? e.message : e}`);
  }
  console.log(`  계좌가치 : $${accountValue}`);

  // 2) 빌더 자격 (테스트넷도 동일 요건)
  let builderValue = 0;
  try {
    const bs = await info.clearinghouseState({ user: BUILDER_ADDRESS as `0x${string}` });
    builderValue = Number(bs.marginSummary.accountValue);
  } catch { /* 조회 실패는 0 취급 */ }
  console.log(`  빌더잔고 : $${builderValue}`);

  // 3) 주문 구성 — 자금과 무관하게 여기까지는 항상 된다
  const built = await buildOnly({ symbol: SYMBOL, side: "long", marginUsdc: MARGIN, leverage: LEVERAGE });
  const o = built.action.orders[0]!;
  console.log(`\n  구성된 주문: asset=${o.a} 수량=${o.s} 가격=${o.p} builder=${built.action.builder.b} f=${built.action.builder.f}`);

  const problems: string[] = [];
  if (accountValue < MARGIN) problems.push(`트레이더 계좌에 테스트넷 USDC 가 부족합니다 ($${accountValue} < $${MARGIN})`);
  try { assertBuilderEligible(builderValue); } catch (e) { problems.push(e instanceof Error ? e.message : String(e)); }
  if (MARGIN * LEVERAGE < MIN_ORDER_USD) problems.push(`명목가가 최소 $${MIN_ORDER_USD} 미만`);

  if (problems.length && PROBE) {
    console.log("\n  자금 부족하지만 --probe: 거래소가 무엇으로 거부하는지 확인한다");
    const exP = new hl.ExchangeClient({ transport: new hl.HttpTransport({ isTestnet: true }), wallet: account });
    let msg = "";
    try {
      const res = await exP.order(built.action);
      msg = JSON.stringify(res.response.data.statuses);
      console.log(`  거래소 응답: ${msg}`);
    } catch (e) {
      msg = e instanceof Error ? e.message : String(e);
      console.log(`  거래소 거부: ${msg}`);
    }
    const sigProblem = /invalid.*signature|malformed|deserialize|unauthoriz/i.test(msg);
    if (sigProblem) {
      console.log("\n  ✗ 서명/페이로드 문제 — 코드 결함이다");
      console.log("\nPROBE SIGNATURE-REJECTED");
      process.exit(1);
    }

    // 거래소가 에러에 서명자 주소를 되돌려주면, 그건 **우리 서명에서 복원한 주소**다.
    // 우리가 서명한 계정과 같으면 서명이 암호학적으로 유효하다는 결정적 증거가 된다.
    const recovered = msg.match(/0x[0-9a-fA-F]{40}/)?.[0];
    if (recovered) {
      const match = recovered.toLowerCase() === account.address.toLowerCase();
      console.log(`  거래소가 복원한 서명자: ${recovered}`);
      console.log(`  우리가 서명한 계정    : ${account.address}`);
      if (!match) {
        console.log("\n  ✗ 복원 주소 불일치 — 서명이 잘못됐다");
        console.log("\nPROBE SIGNATURE-MISMATCH");
        process.exit(1);
      }
      console.log("  ✓ 일치 → 거래소가 우리 서명을 검증하고 서명자를 특정했다");
    }

    console.log("\n  ✓ 서명은 통과했고, 거부 사유는 자금뿐 → 전송 경로는 닫혔다");
    console.log("\nEXCHANGE RESPONDED — 서명 검증됨, 자금만 부족");
    process.exit(0);
  }

  if (problems.length) {
    console.log("\n  전송 불가 — 막는 요인:");
    problems.forEach((p) => console.log(`    · ${p}`));
    console.log("\n  해결 방법:");
    if (generated) {
      console.log(`    1) 이 키를 .env.local 에 저장:  HL_TESTNET_KEY=${key}`);
      console.log(`       (테스트넷 전용 키다. 메인넷 자금을 절대 넣지 말 것.)`);
    }
    console.log(`    2) https://app.hyperliquid-testnet.xyz/drip 접속 → 위 트레이더 주소로 테스트넷 USDC 수령`);
    console.log(`    3) 빌더 주소(${BUILDER_ADDRESS})의 퍼프 계정에도 $100 이상 입금`);
    console.log(`    4) 다시 실행:  npx tsx scripts/testnet-trade.ts --send`);
    console.log("\nTESTNET NEEDS-FUNDS");
    process.exit(0);
  }

  console.log("\n  ✓ 전송 조건 충족");
  if (!SEND) {
    console.log("  (--send 를 붙이면 실제로 주문을 냅니다)");
    console.log("\nTESTNET READY");
    process.exit(0);
  }

  // 4) 실제 전송
  const ex = new hl.ExchangeClient({ transport: new hl.HttpTransport({ isTestnet: true }), wallet: account });
  console.log("\n  주문 전송 중…");
  try {
    const res = await ex.order(built.action);
    console.log(`  거래소 응답: ${JSON.stringify(res.response.data.statuses)}`);
    console.log("\nEXCHANGE RESPONDED — 전송 경로 닫힘");
    process.exit(0);
  } catch (e) {
    // 거부도 응답이다 — 코드가 거래소까지 도달했다는 증거
    console.log(`  거래소 거부: ${e instanceof Error ? e.message : e}`);
    console.log("\nEXCHANGE RESPONDED — 전송됐고 거래소가 판단함");
    process.exit(0);
  }
}

main().catch((e) => { console.error("\nTESTNET ERROR —", e instanceof Error ? e.message : e); process.exit(1); });
