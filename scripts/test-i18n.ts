// G1/G2 — 다국어. 사전 누락과 하드코딩을 잡는다.
import "../lib/env";
import fs from "node:fs/promises";

const COVERAGE = process.argv.includes("--coverage");
/** 다국어를 적용해야 하는 화면. 여기 한국어가 박혀 있으면 영어 사용자에게 깨져 보인다. */
const UI_FILES = ["app/page.tsx", "components/LiveTicker.tsx", "components/LangProvider.tsx"];

async function main() {
  const { DICT, LANGS, t, detectLang, LANG_LABEL } = await import("../lib/i18n");
  let fail = 0;
  const chk = (n: string, ok: boolean, x = "") => { if (!ok) fail++; console.log(`  ${ok ? "✓" : "✗"} ${n}${x ? "  " + x : ""}`); };

  if (!COVERAGE) {
    const keys = Object.keys(DICT) as (keyof typeof DICT)[];
    console.log(`사전 ${keys.length}개 키 · 언어 ${LANGS.length}종`);

    console.log("\n완전성");
    const missing: string[] = [];
    const empty: string[] = [];
    for (const k of keys) {
      for (const l of LANGS) {
        const v = (DICT[k] as Record<string, string>)[l];
        if (v === undefined) missing.push(`${k}.${l}`);
        else if (!v.trim()) empty.push(`${k}.${l}`);
      }
    }
    chk("누락된 번역 0개", missing.length === 0, missing.slice(0, 3).join(", "));
    chk("빈 번역 0개", empty.length === 0, empty.slice(0, 3).join(", "));

    console.log("\n번역이 실제로 다른가 (복붙 방지)");
    const identical = keys.filter((k) => {
      const d = DICT[k] as Record<string, string>;
      // 고유명사·기호만 있는 건 같아도 정상
      return d.ko === d.en && !/^[\s\d$%.·—-]*$/.test(d.ko);
    });
    chk("한/영이 같은 항목 0개", identical.length === 0, identical.slice(0, 4).join(", "));

    console.log("\nt() 동작");
    chk("한국어 반환", t("hero.cta.try", "ko") === "터미널 열어보기");
    chk("영어 반환", t("hero.cta.try", "en") === "Open the terminal");
    chk("변수 치환", t("sub.freeDesc", "en", { n: 5 }) === "5 calls per day");
    chk("없는 키는 키 자체 반환 (화면에서 눈에 띄게)", t("nope.nope" as never, "en") === "nope.nope");

    console.log("\n언어 감지");
    chk("ko-KR → ko", detectLang("ko-KR,ko;q=0.9") === "ko");
    chk("en-US → en", detectLang("en-US,en;q=0.9") === "en");
    chk("없으면 기본값", detectLang(null) === "en");
    chk("라벨 정의됨", LANG_LABEL.ko === "한국어" && LANG_LABEL.en === "English");

    console.log(fail === 0 ? "\nI18N OK — 사전 완전" : `\nI18N FAIL — ${fail}건`);
    process.exit(fail === 0 ? 0 : 1);
  }

  // ── 커버리지: UI 에 한국어 하드코딩이 남았는가 ──────────
  console.log("UI 하드코딩 검사");
  const HANGUL = /[가-힣]/;
  for (const f of UI_FILES) {
    const src = await fs.readFile(f, "utf8").catch(() => "");
    const lines = src.split("\n");
    const bad: string[] = [];
    lines.forEach((line, i) => {
      if (!HANGUL.test(line)) return;
      const trimmed = line.trim();
      // 주석은 허용 — 코드 설명은 한국어로 쓰는 게 이 레포 관례다.
      // JSX 주석 {/* … */} 도 포함한다.
      if (/^(\/\/|\*|\/\*|\{\/\*)/.test(trimmed)) return;
      // LiveTicker 의 WATCH 배열은 사전 대신 인라인 쌍을 쓴다 — ko/en 이 함께 있으므로 허용
      if (/^\s*\[".*",\s*".*",\s*".*"\],?\s*$/.test(line)) return;
      bad.push(`${f}:${i + 1} ${trimmed.slice(0, 56)}`);
    });
    chk(`${f} 한국어 하드코딩 0건`, bad.length === 0, bad.slice(0, 2).join(" | "));
  }

  console.log("\n사전 경유 여부");
  const landing = await fs.readFile("app/page.tsx", "utf8");
  const tCalls = (landing.match(/\bt\("/g) ?? []).length;
  chk("랜딩이 t() 를 충분히 쓴다", tCalls >= 20, `${tCalls}회`);
  chk("LangSwitch 가 붙어 있다", landing.includes("<LangSwitch"));
  const layout = await fs.readFile("app/layout.tsx", "utf8");
  chk("LangProvider 가 layout 에 있다", layout.includes("LangProvider"));

  console.log(fail === 0 ? "\nCOVERAGE OK — UI 하드코딩 없음" : `\nCOVERAGE FAIL — ${fail}건`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error("I18N FAIL —", e instanceof Error ? e.message : e); process.exit(1); });
