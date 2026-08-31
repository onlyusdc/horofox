// G11 — 빌드 산출물에 시크릿이 박히지 않는가.
//
// 실제로 한 번 유출됐다: Next 가 빌드 시 .env.local 을 읽어 process.env 참조를
// 번들에 인라인하는 바람에 API 키가 Worker 코드에 박혀 배포됐다.
// scripts/deploy-cf.sh 가 빌드 동안 .env.local 을 치우지만, 그게 실제로
// 동작하는지 여기서 검증한다.
import "../lib/env";
import fs from "node:fs/promises";
import path from "node:path";

const SECRET_KEYS = ["OPENAI_API_KEY", "GATEWAY_API_KEYS", "HL_TRADER_KEY", "HL_TESTNET_KEY", "USER_ENCRYPTION_KEY", "TELEGRAM_BOT_TOKEN", "DISCORD_BOT_TOKEN"];

async function walk(dir: string, out: string[] = []): Promise<string[]> {
  let entries;
  try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await walk(p, out);
    else if (/\.(js|mjs|cjs|json|html)$/.test(e.name)) out.push(p);
  }
  return out;
}

async function main() {
  let fail = 0;
  const t = (n: string, ok: boolean, x = "") => { if (!ok) fail++; console.log(`  ${ok ? "✓" : "✗"} ${n}${x ? "  " + x : ""}`); };

  // .env.local 의 실제 값들을 수집 (있으면)
  let envValues: string[] = [];
  try {
    const raw = await fs.readFile(".env.local", "utf8");
    envValues = raw.split("\n")
      .map((l) => l.split("="))
      .filter(([k, ...v]) => SECRET_KEYS.includes(k?.trim() ?? "") && v.join("=").trim().length >= 8)
      .map(([, ...v]) => v.join("=").trim());
  } catch { /* .env.local 없음 */ }

  console.log(`검사 대상 시크릿 ${envValues.length}개 (.env.local 기준)`);

  const files = await walk(".open-next");
  t(".open-next 빌드 산출물 존재", files.length > 0, `${files.length}개 파일`);
  if (files.length === 0) {
    console.log("\n  빌드를 먼저 실행하세요: ./scripts/deploy-cf.sh 또는 npx opennextjs-cloudflare build");
    console.log("\nNOSECRETS SKIP — 검사할 산출물 없음");
    process.exit(0);
  }

  console.log("\n번들 전수 검사");
  const hits: string[] = [];
  for (const f of files) {
    const src = await fs.readFile(f, "utf8").catch(() => "");
    for (const v of envValues) if (src.includes(v)) hits.push(`${f} ← 실제 시크릿 값`);
    // 값이 없어도 키:값 형태로 인라인된 흔적을 잡는다
    if (/"(OPENAI_API_KEY|GATEWAY_API_KEYS|HL_TRADER_KEY|USER_ENCRYPTION_KEY)":"[^"]{8,}"/.test(src)) {
      hits.push(`${f} ← 인라인된 env 객체`);
    }
    // OpenAI 키 형태만. `sk-async-storage-instance` 같은 Next 내부 식별자를 걸러야 하므로
    // 하이픈 없는 20자 이상 영숫자만 인정한다 (실제 키는 sk-proj-… 또는 sk-<base62>).
    if (/\bsk-(proj-)?[A-Za-z0-9]{20,}\b/.test(src)) hits.push(`${f} ← OpenAI 키 형태`);
  }

  t("번들에 실제 시크릿 값 0건", hits.length === 0);
  if (hits.length) [...new Set(hits)].slice(0, 6).forEach((h) => console.log(`      ${h}`));

  console.log("\n배포 스크립트가 방어하는가");
  const sh = await fs.readFile("scripts/deploy-cf.sh", "utf8").catch(() => "");
  t("빌드 중 .env.local 을 치운다", sh.includes(".env.local.build-hidden"));
  t("빌드 후 시크릿 검사를 한다", sh.includes("번들에 시크릿이 박혔는지"));
  t("검출 시 배포를 중단한다", sh.includes("exit 1"));
  t("trap 으로 .env.local 을 복구한다", sh.includes("trap cleanup EXIT"));

  console.log(fail === 0 ? "\nNOSECRETS OK — 번들 청결" : `\nNOSECRETS FAIL — ${fail}건`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error("NOSECRETS FAIL —", e instanceof Error ? e.message : e); process.exit(1); });
