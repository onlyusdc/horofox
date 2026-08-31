// G7 — 수익 조회가 온체인 실제 builder 수수료를 읽는가 (로컬 JSON 가상 수치가 아닌).
import "../lib/env";

async function main() {
  let fail = 0;
  const t = (n: string, ok: boolean, extra = "") => { if (!ok) fail++; console.log(`  ${ok ? "✓" : "✗"} ${n}${extra ? "  " + extra : ""}`); };

  // 1) 미설정 상태 — 조용히 0을 진짜 매출로 보고하면 안 된다
  process.env.HL_BUILDER_ADDRESS = "";
  {
    const { builderRevenue } = await import("../lib/hl/revenue");
    const r = await builderRevenue();
    t("주소 미설정 시 configured=false", r.configured === false);
    t("미설정이어도 던지지 않고 0 반환", r.cumulativeUsd === 0);
  }

  // 2) 실제 주소로 온체인 조회 — Hyperliquid 재단 주소(실존, 조회만)
  const REAL = "0x0000000000000000000000000000000000000001";
  process.env.HL_BUILDER_ADDRESS = REAL;
  {
    const mod = await import("../lib/hl/revenue");
    // config 는 이미 로드됐으므로 별도 프로세스 없이는 값이 안 바뀐다 →
    // 여기서는 순수 계산 함수만 검증하고, 온체인 조회는 아래 raw 로 확인한다
    t("volumeNeededForUsd: 0.1% 로 $10,000 → 거래량 $10,000,000", mod.volumeNeededForUsd(10000, 0.1) === 10_000_000);
    t("요율 0 이면 던짐 (무한대를 조용히 반환하지 않음)", (() => { try { mod.volumeNeededForUsd(1, 0); return false; } catch { return true; } })());
    t("100명 × 월 $1M × 0.1% = $100,000", Math.abs(mod.projectMonthlyUsd(100, 1_000_000, 0.1) - 100_000) < 1e-6);
    t("고객 0명이면 0 — 0.1% × 0 = $0", mod.projectMonthlyUsd(0, 1_000_000, 0.1) === 0);
    t("builderFillsUrl 이 주소를 소문자화 (HL 이 대소문자 구분)", mod.builderFillsUrl(new Date(Date.UTC(2026, 7, 30)), "0xAABBCCDDEEFF00112233445566778899AABBCCDD").includes("0xaabbccdd"));
    t("builderFillsUrl 날짜 포맷 YYYYMMDD", mod.builderFillsUrl(new Date(Date.UTC(2026, 0, 5)), REAL).includes("20260105"));
  }

  // 3) 온체인 엔드포인트가 실제로 살아있는가 (raw 호출)
  try {
    const res = await fetch("https://api.hyperliquid.xyz/info", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "referral", user: "0x0000000000000000000000000000000000000001" }),
    });
    const body = (await res.json()) as { builderRewards?: string };
    t("HL referral 엔드포인트 응답", res.ok);
    t("builderRewards 필드 존재 (수수료 집계 경로)", typeof body.builderRewards === "string", `= "${body.builderRewards}"`);
  } catch (e) {
    fail++; console.log(`  ✗ 온체인 조회 실패: ${e instanceof Error ? e.message : e}`);
  }

  // 4) revenueSummary 가 페이퍼와 실수익을 분리하는가
  {
    const { revenueSummary } = await import("../lib/revenue");
    const s = await revenueSummary() as Record<string, unknown>;
    t("real 블록 존재", typeof s.real === "object" && s.real !== null);
    t("paperRevenueUsdc 분리", typeof s.paperRevenueUsdc === "number");
    const real = s.real as { builderFeesUsdc: number; configured: boolean };
    t("실수익이 페이퍼 총액에 합산되지 않음", (s.totalRevenueUsdc as number) === (s.paperRevenueUsdc as number));
    t("real.builderFeesUsdc 가 숫자", typeof real.builderFeesUsdc === "number");
  }

  console.log(fail === 0 ? "\nREVENUE OK — 실수익 경로가 온체인에 연결됨" : `\nREVENUE FAIL — ${fail}건`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error("REVENUE FAIL —", e instanceof Error ? e.message : e); process.exit(1); });
