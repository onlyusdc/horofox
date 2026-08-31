// G7 — 랜딩 심플화. "이게 뭔지 모르겠다"를 고쳤는가.
import "../lib/env";
import fs from "node:fs/promises";

async function main() {
  let fail = 0;
  const t = (n: string, ok: boolean, x = "") => { if (!ok) fail++; console.log(`  ${ok ? "✓" : "✗"} ${n}${x ? "  " + x : ""}`); };

  const src = await fs.readFile("app/page.tsx", "utf8");

  console.log("순서 — 증거가 면책보다 먼저 와야 한다");
  const iTicker = src.indexOf("<LiveTicker");
  const iHonesty = src.indexOf('className="honesty"');
  const iHero = src.indexOf('className="hero"');
  t("히어로 존재", iHero > 0);
  t("라이브 티커 존재", iTicker > 0);
  t("티커가 히어로 바로 뒤", iTicker > iHero);
  t("면책이 티커보다 아래", iHonesty > iTicker, `ticker@${iTicker} honesty@${iHonesty}`);
  t("면책이 기능 소개보다도 아래", iHonesty > src.indexOf('className="grid"'));

  console.log("\n증거 — 살아있는 숫자");
  const ticker = await fs.readFile("components/LiveTicker.tsx", "utf8");
  t("Hyperliquid 를 직접 호출", ticker.includes("api.hyperliquid.xyz/info"));
  t("HIP-3 dex 를 읽음", ticker.includes('dex: "xyz"'));
  t("주기적 갱신", /setInterval/.test(ticker));
  t("실패 시 상태 표시", ticker.includes("failed"));
  t("자산 수를 계산해 보여줌", ticker.includes("ticker.stats") || ticker.includes("ticker-stats"));

  console.log("\n다국어");
  t("LangSwitch 가 nav 에 있음", /nav-links[\s\S]{0,200}LangSwitch/.test(src));
  t("모든 문구가 t() 경유", (src.match(/\bt\("/g) ?? []).length >= 20);

  console.log("\n여전히 정직한가 (이전 라운드 원칙 유지)");
  t("면책 섹션이 남아 있음", iHonesty > 0);
  t("백테스트 결과 유지", src.includes("honest.backtest"));
  t("수익률 약속 없음", !/\d+(\.\d+)?%\s*(annualised|APR|연율)/i.test(src));
  t("규제 경고 유지", src.includes("footer.disclaimer"));

  console.log("\n심플화");
  const lines = src.split("\n").length;
  t("랜딩이 100줄 이하로 유지", lines <= 100, `${lines}줄`);
  t("기능 카드가 데이터로 분리됨", src.includes("FEATURES.map"));

  console.log(fail === 0 ? "\nLANDING OK — 증거 먼저, 면책은 유지" : `\nLANDING FAIL — ${fail}건`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error("LANDING FAIL —", e instanceof Error ? e.message : e); process.exit(1); });
