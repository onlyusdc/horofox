// G3 — builder code 가 모든 주문에 붙는가. 이 서비스 매출의 100%가 여기 달렸다.
// config 가 모듈 로드 시 env 를 읽으므로 동적 import 를 쓴다 (ES import 는 호이스팅됨).
import "../lib/env";

const TB = "0x1111111111111111111111111111111111111111";
process.env.HL_BUILDER_ADDRESS = TB;

async function main() {
  const { buildOrderAction, buildCloseAction, assertBuilderAttached, builderField } = await import("../lib/hl/core");

  let fail = 0;
  const t = (n: string, fn: () => void) => { try { fn(); console.log(`  ✓ ${n}`); } catch (e) { fail++; console.log(`  ✗ ${n}: ${e instanceof Error ? e.message : e}`); } };
  const throws = (fn: () => unknown, m: string) => { try { fn(); } catch { return; } throw new Error(`던져야 함: ${m}`); };

  const BTC = { index: 0, name: "BTC", symbol: "BTC", szDecimals: 5, maxLeverage: 40, dex: null };
  const SKHX = { index: 110022, name: "xyz:SKHX", symbol: "SKHX", szDecimals: 3, maxLeverage: 10, dex: "xyz" };

  console.log("builderField");
  t("내 주소와 f=100 (0.1%)", () => { const b = builderField(0.1); if (b.b !== TB || b.f !== 100) throw new Error(JSON.stringify(b)); });
  t("퍼프 상한 초과 거부", () => throws(() => builderField(0.2), "0.2%"));

  console.log("\n모든 인자 조합에서 builder 존재 (스윕)");
  let n = 0;
  for (const side of ["long", "short"] as const)
    for (const asset of [BTC, SKHX])
      for (const limitPx of [undefined, 100])
        for (const tp of [undefined, { type: "percent" as const, value: 10 }])
          for (const sl of [undefined, { type: "price" as const, value: 50 }]) {
            const a = buildOrderAction({ asset, side, notionalUsd: 1000, midPx: 100, limitPx, tp, sl });
            if (a.builder?.b !== TB || a.builder.f !== 100) { fail++; console.log(`  ✗ 조합 ${n} builder 누락`); }
            assertBuilderAttached(a);
            n++;
          }
  console.log(`  ✓ ${n}개 조합 전부 builder 부착`);

  console.log("\n청산 주문에도 붙는가");
  t("롱 청산 = 매도 + reduceOnly + builder", () => { const a = buildCloseAction({ asset: BTC, positionSize: 0.05, fraction: 1, midPx: 78785 }); if (a.orders[0]!.b !== false || a.orders[0]!.r !== true || a.builder.b !== TB) throw new Error("불일치"); });
  t("HIP-3 청산에도 붙음", () => { const a = buildCloseAction({ asset: SKHX, positionSize: -1.5, fraction: 0.5, midPx: 1200 }); if (a.builder.b !== TB || a.orders[0]!.a !== 110022) throw new Error("불일치"); });

  console.log("\nassertBuilderAttached — 마지막 방어선");
  const good = buildOrderAction({ asset: BTC, side: "long", notionalUsd: 1000, midPx: 78785 });
  t("정상 통과", () => assertBuilderAttached(good));
  t("builder 없으면 거부", () => throws(() => assertBuilderAttached({ ...good, builder: undefined as never }), "builder 없음"));
  t("영주소 거부", () => throws(() => assertBuilderAttached({ ...good, builder: { b: "0x0000000000000000000000000000000000000000", f: 100 } }), "영주소"));
  t("f=0 거부 (수수료 0짜리)", () => throws(() => assertBuilderAttached({ ...good, builder: { b: TB, f: 0 } }), "f=0"));
  t("f 상한 초과 거부", () => throws(() => assertBuilderAttached({ ...good, builder: { b: TB, f: 1001 } }), "f=1001"));

  console.log("\nHIP-3 주문의 assetId 가 오프셋 적용값인가");
  t("SKHX 주문 a=110022 (22 아님)", () => { const a = buildOrderAction({ asset: SKHX, side: "long", notionalUsd: 1000, midPx: 1209 }); if (a.orders[0]!.a !== 110022) throw new Error(`a=${a.orders[0]!.a}`); });

  console.log(fail === 0 ? "\nBUILDER OK — 우회 경로 없음" : `\nBUILDER FAIL — ${fail}건`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
