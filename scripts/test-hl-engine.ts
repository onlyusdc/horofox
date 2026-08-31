// G1 — 이식된 엔진 자체 검증 (네트워크 불필요, 순수 계산)
import "../lib/env";
process.env.HL_BUILDER_ADDRESS ||= "0x1111111111111111111111111111111111111111";

import { percentToF, fToPercent, percentToMaxFeeRate, assertFeeWithinCap, feeUsd } from "../lib/hl/units";
import { formatPrice, formatSize, sizeFromUsd, slippagePrice, stripTrailingZeros } from "../lib/hl/rounding";
import { assetId, HIP3_ASSET_OFFSET, HIP3_DEX_STRIDE } from "../lib/hl/core";

let fail = 0;
const t = (name: string, fn: () => void) => {
  try { fn(); console.log(`  ✓ ${name}`); }
  catch (e) { fail++; console.log(`  ✗ ${name}: ${e instanceof Error ? e.message : e}`); }
};
const eq = (a: unknown, b: unknown, m = "") => {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m} ${JSON.stringify(a)} !== ${JSON.stringify(b)}`);
};
const throws = (fn: () => unknown, m: string) => {
  try { fn(); } catch { return; }
  throw new Error(`던져야 하는데 안 던짐: ${m}`);
};

console.log("단위 변환 — 0.1% 와 f=100 은 같은 값의 다른 표기다");
t("0.1% → f=100", () => eq(percentToF(0.1), 100));
t("1% → f=1000 (스팟 상한)", () => eq(percentToF(1), 1000));
t("f=100 → 0.1%", () => eq(fToPercent(100), 0.1));
t("왕복 항등", () => { for (const p of [0.001, 0.01, 0.05, 0.1, 0.5, 1]) eq(fToPercent(percentToF(p)), p, `p=${p}`); });
t("부동소수 오차가 f 를 비정수로 만들지 않음", () => { for (const p of [0.1, 0.3, 0.07]) if (!Number.isInteger(percentToF(p))) throw new Error(`${p}`); });
t("승인 문자열은 '0.1%' 이지 '100%' 가 아님", () => { eq(percentToMaxFeeRate(0.1), "0.1%"); if (percentToMaxFeeRate(0.1) === `${percentToF(0.1)}%`) throw new Error("단위 혼동"); });
t("퍼프 상한 초과 거부", () => throws(() => assertFeeWithinCap(0.11, "perp"), "0.11% perp"));
t("명목가 $1000 × 0.1% = $1", () => { if (Math.abs(feeUsd(1000, 0.1) - 1) > 1e-9) throw new Error("계산 불일치"); });

console.log("\n라운딩 — HL 주문 거부 1위 원인");
t("공식예제 1234.5 유효", () => eq(formatPrice(1234.5, 1, "perp"), "1234.5"));
t("공식예제 1234.56 → 유효숫자 5자리로 절삭", () => eq(formatPrice(1234.56, 1, "perp"), "1234.6"));
t("BTC 78785.5 (szDec=5) → 정수 허용", () => eq(formatPrice(78785.5, 5, "perp"), "78786"));
t("표현 불가한 가격은 조용히 0이 되지 않고 던짐", () => throws(() => formatPrice(0.00001234, 5, "perp"), "언더플로"));
t("수량 szDecimals 반올림", () => eq(formatSize(0.123456789, 5), "0.12346"));
t("반올림 후 0 이면 던짐", () => throws(() => formatSize(0.000001, 3), "수량 0"));
t("명목가→수량 (레버리지는 곱하지 않음)", () => { if (Math.abs(Number(sizeFromUsd(1000, 100, 2)) - 10) > 1e-9) throw new Error("환산 오류"); });
t("매수 슬리피지는 위로", () => { if (Number(slippagePrice(1000, true, 0.05, 2)) <= 1000) throw new Error("방향 오류"); });
t("정수의 후행 0 을 지우지 않음 (100 → 100)", () => eq(stripTrailingZeros("100"), "100"));

console.log("\nHIP-3 자산 ID — 틀리면 다른 종목에 주문이 나간다");
t("공식 상수", () => { eq(HIP3_ASSET_OFFSET, 100000); eq(HIP3_DEX_STRIDE, 10000); });
t("메인 dex 는 오프셋 없음", () => { eq(assetId(0, null), 0); eq(assetId(159, 0), 159); });
t("xyz(perpDexIndex=1) 실측 대조", () => { eq(assetId(22, 1), 110022); eq(assetId(99, 1), 110099); eq(assetId(34, 1), 110034); eq(assetId(65, 1), 110065); });
t("dex 경계 침범 거부", () => throws(() => assetId(HIP3_DEX_STRIDE, 1), "간격 초과"));
t("모든 조합에서 ID 유일", () => { const s = new Set<number>(); for (let d = 1; d <= 10; d++) for (const i of [0, 1, 50, 9999]) { const id = assetId(i, d); if (s.has(id)) throw new Error(`중복 ${id}`); s.add(id); } eq(s.size, 40); });

console.log(fail === 0 ? "\nENGINE OK — 전부 통과" : `\nENGINE FAIL — ${fail}건 실패`);
process.exit(fail === 0 ? 0 : 1);
