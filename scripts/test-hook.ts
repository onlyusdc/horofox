// G1 — 훅. 수익률을 약속하는 문장이 하나라도 있으면 실패다.
// 백테스트가 마이너스인 걸 알면서 "번다"고 쓰면 그건 거짓 광고다.
import "../lib/env";
import fs from "node:fs/promises";

/** 수익 약속으로 읽힐 수 있는 표현. 발견되면 실패. */
const FORBIDDEN: [RegExp, string][] = [
  [/\d+(\.\d+)?%\s*(annualised|annualized|APR|연율|연\s*\d)/i, "연율 수익률 제시"],
  [/카르카|carry.{0,20}(earn|수익|번다|법니다)/i, "캐리로 번다"],
  [/무위험|risk[- ]free|guaranteed|보장|확정 수익/i, "무위험·보장 표현"],
  [/free money|공짜 돈|땅 짚고/i, "공짜 돈"],
  [/수익률\s*\d|월\s*\$\d[\d,]*\s*(벌|수익)/i, "구체적 수익 약속"],
  [/72\.9|72%/i, "폐기된 캐리 수치"],
];

/** 반드시 있어야 하는 정직성 문구. */
const REQUIRED_LANDING = [
  ["수익을 약속하지 않습니다", "수익 미약속 고지"],
  ["백테스트", "백테스트 언급"],
  ["−5.65%", "무헤지 백테스트 수치"],
  ["−0.60%", "델타중립 백테스트 수치"],
  ["읽기 전용", "데모 한계 고지"],
  ["투자 조언이 아닙니다", "면책"],
  ["무인가 금융투자업", "규제 경고"],
  ["0.1%", "수수료 공개"],
];
const REQUIRED_README = [
  ["수익을 약속하지 않는다", "README 수익 미약속"],
  ["−5.65%", "README 백테스트 수치"],
  ["거래 도구지 전략이 아니다", "포지셔닝"],
  ["280종", "자산 도달 범위"],
];

async function main() {
  let fail = 0;
  const t = (n: string, ok: boolean, x = "") => { if (!ok) fail++; console.log(`  ${ok ? "✓" : "✗"} ${n}${x ? "  " + x : ""}`); };

  const landing = await fs.readFile("app/page.tsx", "utf8");
  const readme = await fs.readFile("README.ko.md", "utf8");

  console.log("금지 표현 — 수익률 약속");
  for (const [re, label] of FORBIDDEN) {
    const inLanding = re.test(landing);
    // README 는 백테스트 결과를 인용하므로 −5.65% 같은 음수는 허용된다.
    // 금지 패턴은 '번다'는 주장에만 걸리게 짜여 있다.
    const inReadme = re.test(readme);
    t(`${label} 없음 (랜딩)`, !inLanding, inLanding ? re.exec(landing)?.[0] : "");
    t(`${label} 없음 (README)`, !inReadme, inReadme ? re.exec(readme)?.[0] : "");
  }

  console.log("\n필수 고지 — 랜딩");
  for (const [needle, label] of REQUIRED_LANDING) t(label, landing.includes(needle));

  console.log("\n필수 고지 — README");
  for (const [needle, label] of REQUIRED_README) t(label, readme.includes(needle));

  console.log("\n훅 자체");
  t("헤드라인이 접근을 말한다 (수익 아님)", landing.includes("온체인에서 산다"));
  t("검증 가능성을 내세운다", landing.includes("GitHub") && landing.includes("코드"));
  t("HIP-3 자산을 구체적으로 든다", /NVDA|S&P500|SK하이닉스/.test(landing));

  console.log("\n실제 자산 수가 주장과 맞는가");
  process.env.HL_BUILDER_ADDRESS ||= "0x1111111111111111111111111111111111111111";
  const { assets } = await import("../lib/hl/trade");
  const uniq = new Set([...(await assets()).values()]);
  const total = uniq.size;
  const main = [...uniq].filter((a) => a.dex === null).length;
  const xyz = [...uniq].filter((a) => a.dex === "xyz").length;
  t(`"280종" 주장이 실측(${total}종)과 ±20 이내`, Math.abs(total - 280) <= 20, `main=${main} xyz=${xyz}`);
  t(`"코어 177" 주장이 실측(${main})과 ±15 이내`, Math.abs(main - 177) <= 15);

  console.log(fail === 0 ? "\nHOOK OK — 수익 약속 0건, 고지 완비" : `\nHOOK FAIL — ${fail}건`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error("HOOK FAIL —", e instanceof Error ? e.message : e); process.exit(1); });
