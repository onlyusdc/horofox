// G2 — HIP-3 도달성. 실제 Hyperliquid 를 친다 (읽기 전용, 주문 없음).
import "../lib/env";
process.env.HL_BUILDER_ADDRESS ||= "0x1111111111111111111111111111111111111111";
import { assets, midPrice, resolveAsset } from "../lib/hl/trade";

const MEM = ["SKHX", "SKHY", "SMSN", "DRAM", "MU", "SNDK"];

async function main() {
  const bad: string[] = [];
  const map = await assets();
  console.log(`자산 로드: ${map.size}개 키 (심볼+정식이름 양쪽 등록)`);

  const btc = map.get("BTC");
  if (btc && btc.index === 0 && btc.dex === null) console.log("  ✓ 메인 dex 정상 — BTC index=0");
  else bad.push(`BTC 메타 이상: ${JSON.stringify(btc)}`);

  console.log("\nHIP-3 (xyz dex) — 이게 막히면 주식·지수 퍼프를 아예 못 만진다");
  let ok = 0;
  for (const s of MEM) {
    try {
      const a = await resolveAsset(s);
      if (a.dex !== "xyz") { bad.push(`${s} dex=${a.dex}`); continue; }
      if (a.index < 100000) { bad.push(`${s} assetId 오프셋 미적용: ${a.index}`); continue; }
      const px = await midPrice(s);
      if (!(px > 0)) { bad.push(`${s} 가격 ${px}`); continue; }
      console.log(`  ✓ ${s.padEnd(5)} assetId=${a.index} szDec=${a.szDecimals} lev=${a.maxLeverage}x  $${px.toLocaleString("en-US")}`);
      ok++;
    } catch (e) { bad.push(`${s}: ${e instanceof Error ? e.message : e}`); }
  }

  if (bad.length === 0 && ok === MEM.length) console.log(`\nHIP3 OK ${ok}/${MEM.length}`);
  else { console.log(`\nHIP3 FAIL — ${bad.length}건`); bad.forEach((b) => console.log(`  - ${b}`)); }
  process.exit(bad.length === 0 && ok === MEM.length ? 0 : 1);
}

main();
