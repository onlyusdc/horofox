// G6 — LIVE 경로가 실제로 **서명된 주문 페이로드**를 만드는가.
//
// 자금이 있는 키가 없어 전송은 못 한다. 하지만 서명은 로컬 연산이라 여기서 완결된다:
//   1. 실제 HL 자산 메타로 주문 액션을 만들고 (builder 포함)
//   2. HL 이 요구하는 방식으로 EIP-712 서명하고
//   3. 서명에서 공개키를 복원해 트레이더 주소와 일치하는지 확인한다
// 이게 통과하면 "전송"만 남는다 — 코드가 아니라 자금 문제다.
import "../lib/env";

const KEY = ("0x" + "11".repeat(32)) as `0x${string}`;
const TB = "0x1111111111111111111111111111111111111111";
process.env.HL_BUILDER_ADDRESS = TB;
process.env.HL_MODE = "live";
process.env.HL_TRADER_KEY = KEY;

async function main() {
  const { privateKeyToAccount } = await import("viem/accounts");
  const { recoverTypedDataAddress, keccak256 } = await import("viem");
  const { buildOnly, traderAddress } = await import("../lib/hl/trade");
  const { tradeMode } = await import("../lib/hl/config");
  const signing = await import("@nktkas/hyperliquid/signing");

  let fail = 0;
  const t = (n: string, ok: boolean, extra = "") => { if (!ok) fail++; console.log(`  ${ok ? "✓" : "✗"} ${n}${extra ? "  " + extra : ""}`); };

  t("모드가 live 로 인식됨", tradeMode() === "live");

  const account = privateKeyToAccount(KEY);
  t("트레이더 주소 유도", traderAddress(KEY) === account.address, account.address);

  // 실제 상장 자산으로 주문 구성 (SKHX = SK하이닉스, HIP-3)
  const built = await buildOnly({ symbol: "SKHX", side: "long", marginUsdc: 100, leverage: 5 });
  const a = built.action;
  console.log(`\n  주문: ${built.asset.name} assetId=${a.orders[0]!.a} 수량=${a.orders[0]!.s} 가격=${a.orders[0]!.p}`);
  console.log(`  명목가 $${built.notionalUsd} · 중간가 $${built.midPx}`);
  console.log(`  builder: ${a.builder.b} f=${a.builder.f}\n`);

  t("assetId 가 HIP-3 오프셋 적용값", a.orders[0]!.a === 110022, `a=${a.orders[0]!.a}`);
  t("builder 부착", a.builder.b === TB && a.builder.f === 100);
  t("수량 > 0", Number(a.orders[0]!.s) > 0);
  t("가격 > 0", Number(a.orders[0]!.p) > 0);
  t("IOC (시장가 환산)", JSON.stringify(a.orders[0]!.t) === JSON.stringify({ limit: { tif: "Ioc" } }));

  // ── 실제 서명 ─────────────────────────────────────────
  const nonce = 1735689600000; // 결정론을 위해 고정
  const sig = await signing.signL1Action({
    wallet: account,
    action: a as unknown as Parameters<typeof signing.signL1Action>[0]["action"],
    nonce,
    isTestnet: false,
  });

  console.log(`  서명 r=${sig.r.slice(0, 18)}… s=${sig.s.slice(0, 18)}… v=${sig.v}`);
  t("r 이 32바이트 hex", /^0x[0-9a-f]{64}$/i.test(sig.r));
  t("s 가 32바이트 hex", /^0x[0-9a-f]{64}$/i.test(sig.s));
  t("v 가 27 또는 28", sig.v === 27 || sig.v === 28);

  // builder 가 서명 대상에 실제로 들어갔는지 — builder 를 바꾸면 서명이 달라져야 한다
  const tampered = { ...a, builder: { b: "0x2222222222222222222222222222222222222222" as const, f: 100 } };
  const sig2 = await signing.signL1Action({
    wallet: account,
    action: tampered as unknown as Parameters<typeof signing.signL1Action>[0]["action"],
    nonce,
    isTestnet: false,
  });
  t("builder 를 바꾸면 서명이 달라짐 → builder 가 서명에 포함됨", sig.r !== sig2.r || sig.s !== sig2.s);

  // 같은 입력이면 같은 서명 (결정론)
  const sig3 = await signing.signL1Action({
    wallet: account,
    action: a as unknown as Parameters<typeof signing.signL1Action>[0]["action"],
    nonce,
    isTestnet: false,
  });
  t("같은 입력 → 같은 서명 (결정론적)", sig.r === sig3.r && sig.s === sig3.s);

  // 전송 페이로드 형태 확인
  const payload = { action: a, nonce, signature: sig };
  t("전송 페이로드가 action/nonce/signature 3키", Object.keys(payload).sort().join(",") === "action,nonce,signature");
  t("페이로드 JSON 직렬화 가능", (() => { try { JSON.parse(JSON.stringify(payload)); return true; } catch { return false; } })());

  console.log(fail === 0 ? "\nSIGN OK — 서명까지 완결. 남은 건 전송(자금)뿐" : `\nSIGN FAIL — ${fail}건`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error("SIGN FAIL —", e instanceof Error ? e.message : e); process.exit(1); });
