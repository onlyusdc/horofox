// G5 — 모드 분리. 실수로 실주문이 나가는 경로가 없어야 한다.
// 각 조합마다 자식 프로세스를 띄운다 (config 가 모듈 로드 시 env 를 읽으므로).
import "../lib/env";
import { execFileSync } from "node:child_process";

const KEY = "0x" + "11".repeat(32);
const ADDR = "0x1111111111111111111111111111111111111111";

const CASES: { name: string; env: Record<string, string>; expect: "paper" | "live" }[] = [
  { name: "아무것도 없음 → paper", env: {}, expect: "paper" },
  { name: "키만 있음 → paper (모드 미지정)", env: { HL_TRADER_KEY: KEY }, expect: "paper" },
  { name: "주소만 있음 → paper", env: { HL_BUILDER_ADDRESS: ADDR }, expect: "paper" },
  { name: "live 지정했지만 키 없음 → paper", env: { HL_MODE: "live", HL_BUILDER_ADDRESS: ADDR }, expect: "paper" },
  { name: "live + 키, 그러나 builder 주소 없음 → paper", env: { HL_MODE: "live", HL_TRADER_KEY: KEY }, expect: "paper" },
  { name: "키 + 주소 있으나 모드 미지정 → paper", env: { HL_TRADER_KEY: KEY, HL_BUILDER_ADDRESS: ADDR }, expect: "paper" },
  { name: "HL_MODE=LIVE 대문자도 인식", env: { HL_MODE: "LIVE", HL_TRADER_KEY: KEY, HL_BUILDER_ADDRESS: ADDR }, expect: "live" },
  { name: "세 조건 모두 → live", env: { HL_MODE: "live", HL_TRADER_KEY: KEY, HL_BUILDER_ADDRESS: ADDR }, expect: "live" },
];

const PROBE = `
import { tradeMode, modeReason } from "../lib/hl/config";
console.log(JSON.stringify({ mode: tradeMode(), reason: modeReason() }));
`;

async function main() {
  const fs = await import("node:fs/promises");
  await fs.writeFile("scripts/.mode-probe.ts", PROBE);
  let fail = 0;

  for (const c of CASES) {
    // 부모 env 의 실제 키를 지워 격리한다
    const env = { ...process.env, HL_MODE: "", HL_TRADER_KEY: "", EVM_PRIVATEKEY: "", HL_BUILDER_ADDRESS: "", ...c.env };
    const out = execFileSync("npx", ["tsx", "scripts/.mode-probe.ts"], { env, encoding: "utf8" });
    const line = out.trim().split("\n").filter((l) => l.startsWith("{")).pop() ?? "{}";
    const got = JSON.parse(line) as { mode: string; reason: string };
    const ok = got.mode === c.expect;
    if (!ok) fail++;
    console.log(`  ${ok ? "✓" : "✗"} ${c.name}  →  ${got.mode}${ok ? "" : ` (기대 ${c.expect})`}`);
    if (got.mode === "paper" && !got.reason) { fail++; console.log("    ✗ paper 인데 이유가 비어 있음"); }
  }

  await fs.unlink("scripts/.mode-probe.ts").catch(() => {});
  console.log(fail === 0 ? "\nMODE OK — 기본은 항상 paper, live 는 3조건 전부일 때만" : `\nMODE FAIL — ${fail}건`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
