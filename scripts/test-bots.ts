// G6 — 소셜 봇. 토큰이 없어도 "코드가 안 됨"과 "설정이 없음"을 구분해야 한다.
import "../lib/env";
import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";

async function main() {
  let fail = 0;
  const t = (n: string, ok: boolean, x = "") => { if (!ok) fail++; console.log(`  ${ok ? "✓" : "✗"} ${n}${x ? "  " + x : ""}`); };

  console.log("봇 파일");
  for (const f of ["bot/telegram.ts", "bot/discord.ts", "bot/agent.ts"]) {
    t(`${f} 존재`, await fs.access(f).then(() => true).catch(() => false));
  }

  console.log("\n토큰 없이 기동 시 — 조용히 죽지 않고 이유를 말하는가");
  for (const [script, envVar] of [["bot/telegram.ts", "TELEGRAM_BOT_TOKEN"], ["bot/discord.ts", "DISCORD_BOT_TOKEN"]] as const) {
    const env = { ...process.env, [envVar]: "" };
    let out = "";
    try {
      out = execFileSync("npx", ["tsx", script], { env, encoding: "utf8", timeout: 25_000, stdio: ["ignore", "pipe", "pipe"] });
    } catch (e) {
      const err = e as { stdout?: string; stderr?: string };
      out = `${err.stdout ?? ""}${err.stderr ?? ""}`;
    }
    const mentionsVar = out.includes(envVar);
    t(`${script}: ${envVar} 미설정을 명시`, mentionsVar, out.trim().split("\n").pop()?.slice(0, 60));
  }

  console.log("\n봇이 거래 엔진을 실제로 쓰는가");
  const tg = await fs.readFile("bot/telegram.ts", "utf8");
  const agent = await fs.readFile("bot/agent.ts", "utf8");
  t("텔레그램이 에이전트를 경유", /agent|runAgent|ask/i.test(tg));
  t("에이전트가 tools 를 씀", /tools/.test(agent));

  console.log("\n문서");
  const readme = await fs.readFile("README.ko.md", "utf8");
  t("README 에 봇 실행법", readme.includes("npm run bot"));
  t("README 에 토큰 발급처 안내", /BotFather|discord\.com\/developers/.test(readme));

  console.log(fail === 0 ? "\nBOTS OK — 설정 부재를 코드 결함과 구분" : `\nBOTS FAIL — ${fail}건`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error("BOTS FAIL —", e instanceof Error ? e.message : e); process.exit(1); });
