// G12 — 배포본이 자기 보안 상태를 숨기지 않는가.
// 인증이 열려 있는데 조용하면, 운영자가 모르고 지나간다.
import "../lib/env";

const BASE = process.env.DEPLOY_URL ?? "https://onlyusdc.com";

async function main() {
  let fail = 0;
  const t = (n: string, ok: boolean, x = "") => { if (!ok) fail++; console.log(`  ${ok ? "✓" : "✗"} ${n}${x ? "  " + x : ""}`); };

  const m = await (await fetch(`${BASE}/api/v1/mode`)).json() as {
    ok?: boolean; mode?: string; warnings?: string[]; storage?: string; llm?: string;
    trader?: string | null; builder?: string | null;
  };
  console.log(`대상: ${BASE}`);
  console.log(`  mode=${m.mode} storage=${m.storage} llm=${m.llm} warnings=${m.warnings?.length}\n`);

  console.log("상태 공개");
  t("mode 노출", m.mode === "paper" || m.mode === "live");
  t("storage 상태 노출", m.storage === "read-only" || m.storage === "writable");
  t("LLM 설정 여부 노출", m.llm === "configured" || m.llm === "not-configured");
  t("warnings 배열 존재", Array.isArray(m.warnings));

  console.log("\n인증이 열려 있으면 스스로 경고하는가");
  const openApi = (await fetch(`${BASE}/api/v1/perps`)).status === 200;
  const warned = (m.warnings ?? []).some((w) => w.includes("AGENT_API_KEY"));
  t("인증 개방 상태를 경고로 알림", !openApi || warned, openApi ? (warned ? "개방+경고 ✓" : "개방인데 경고 없음") : "인증됨");

  console.log("\n비밀은 절대 노출되지 않는가");
  const raw = JSON.stringify(m);
  t("개인키 형태 없음", !/0x[0-9a-fA-F]{64}/.test(raw));
  t("API 키 형태 없음", !/\bsk-(proj-)?[A-Za-z0-9]{20,}\b/.test(raw));
  t("z.ai 키 형태 없음 (32hex.16영숫자)", !/\b[0-9a-f]{32}\.[A-Za-z0-9]{16}\b/.test(raw));
  t("'key'/'secret' 필드명 없음", !/"(.*)(key|secret|token)(.*)":/i.test(raw.replace(/"(feePercent|ok|mode|reason|trader|builder|network|warnings|storage|llm)":/g, "")));

  console.log("\n돈 나가는 경로가 잠겨 있는가");
  const chat = await fetch(`${BASE}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: [] }) });
  const chatBody = await chat.text();
  t("LLM 미설정 시 크레딧 소모 불가", m.llm === "not-configured" ? chatBody.includes("설정돼 있지 않아") : true, `HTTP ${chat.status}`);

  console.log(fail === 0 ? "\nPOSTURE OK — 상태를 숨기지 않음" : `\nPOSTURE FAIL — ${fail}건`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error("POSTURE FAIL —", e instanceof Error ? e.message : e); process.exit(1); });
