// G5 — 런치패드가 페이퍼임을 UI 가 명시하는가.
// 명시 안 하면 유저가 진짜 토큰을 발행한 줄 안다.
import "../lib/env";
import fs from "node:fs/promises";

async function main() {
  let fail = 0;
  const t = (n: string, ok: boolean, x = "") => { if (!ok) fail++; console.log(`  ${ok ? "✓" : "✗"} ${n}${x ? "  " + x : ""}`); };

  const dash = await fs.readFile("app/dashboard/dashboard.tsx", "utf8");
  const css = await fs.readFile("app/globals.css", "utf8");
  const lp = await fs.readFile("lib/launchpad.ts", "utf8");
  const dict = await fs.readFile("lib/i18n.ts", "utf8");

  console.log("UI 고지");
  t("대시보드에 페이퍼 경고 있음", dash.includes("paper-warn"));
  t("'온체인 발행이 아닙니다' 명시", dash.includes("온체인 발행이 아닙니다"));
  t("'토큰도 유동성도 실재하지 않' 명시", dash.includes("실재하지 않"));
  t("실매출과 구분 안내", dash.includes("실제 매출은 위의 builder"));
  t("경고 스타일 정의됨", css.includes(".paper-warn"));

  console.log("사전에 다국어 키 존재");
  t("launchpad.paperWarning 키", dict.includes("launchpad.paperWarning"));
  t("한/영 둘 다", /launchpad\.paperWarning[\s\S]{0,400}?ko:[\s\S]{0,300}?en:/.test(dict));

  console.log("코드도 페이퍼임을 밝히는가");
  t("launchpad.ts 가 페이퍼로 문서화됨", /페이퍼|paper/i.test(lp.slice(0, 600)));
  t("온체인 호출이 없음 (진짜 발행 아님)", !/writeContract|sendTransaction|deployContract/.test(lp));

  console.log("툴 설명도 일치하는가");
  const tools = await fs.readFile("lib/tools.ts", "utf8");
  t("launchToken 설명에 paper 명시", /paper bonding curve/i.test(tools));

  console.log(fail === 0 ? "\nLAUNCHPAD-UI OK — 페이퍼임이 명시됨" : `\nLAUNCHPAD-UI FAIL — ${fail}건`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error("LAUNCHPAD-UI FAIL —", e instanceof Error ? e.message : e); process.exit(1); });
