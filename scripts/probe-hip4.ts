// G2 — HIP-4(예측시장)를 우리 주문 경로로 거래할 수 있나.
//
// 문서가 아니라 API 에 물어본다. 그리고 "메타데이터가 응답한다"를 "거래 가능"으로 세지 않는다 —
// 거래하려면 **주문서**가 있어야 하고, 우리 주문 경로가 그 자산을 지목할 수 있어야 한다.
import "../lib/env";

const post = async (body: unknown) => {
  const r = await fetch("https://api.hyperliquid.xyz/info", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
  return { status: r.status, text: await r.text() };
};

type Outcome = { outcome: number; name: string; venue: string; sideSpecs: { name: string }[] };

async function main() {
  console.log("1) 예측시장이 메인넷에 존재하나");
  const om = JSON.parse((await post({ type: "outcomeMeta" })).text) as {
    outcomes?: Outcome[]; questions?: unknown[]; deployers?: unknown[];
  };
  const outcomes = om.outcomes ?? [];
  console.log(`   outcomes=${outcomes.length} questions=${(om.questions ?? []).length} deployers=${(om.deployers ?? []).length}`);
  const sample = outcomes[0];
  if (sample) console.log(`   샘플: #${sample.outcome} ${sample.name} venue=${sample.venue} sides=${sample.sideSpecs.map((s) => s.name).join("/")}`);

  console.log("\n2) 주문서가 있나 — 없으면 거래할 수 없다");
  let book = false;
  if (sample) {
    for (const coin of [String(sample.outcome), `out:${sample.outcome}`, `@${sample.outcome}`, sample.name]) {
      const r = await post({ type: "l2Book", coin });
      const has = r.status === 200 && r.text.includes("levels");
      if (has) book = true;
      console.log(`   coin=${coin.padEnd(24)} ${has ? "주문서 있음" : "null"}`);
    }
  }

  console.log("\n3) 우리 주문 경로가 지목할 수 있나");
  const dexs = JSON.parse((await post({ type: "perpDexs" })).text) as ({ name?: string } | null)[];
  const inPerpDexs = dexs.some((d) => d?.name === "out");
  console.log(`   assetId() = 100000 + perpDexIndex*10000 + indexInMeta (perp dex 색인 기반)`);
  console.log(`   perpDexs 에 venue "out" 존재? ${inPerpDexs ? "예" : "아니오"}`);

  const tradable = book && inPerpDexs;
  console.log(`\nHIP4-VERDICT=${tradable ? "TRADABLE" : "NOT-YET"}`);
  if (tradable) {
    console.log("   주문서와 주소 체계가 둘 다 확인됐다. 커버리지 확장을 진행할 수 있다.");
  } else {
    console.log("   예측시장은 메인넷에 존재하지만(위 1번), 공개 info API 로 주문서에 닿지 않고");
    console.log("   perp dex 색인에도 나타나지 않는다. 거래 방법이 문서화되지도 않았다");
    console.log("   (hip-4-deployer-actions 문서는 배포자 액션만 다룬다).");
    console.log("   → 추측으로 주소 체계를 만들지 않는다. 문서가 나오면 다시 본다.");
  }
}

main().catch((e) => {
  console.error("HIP4-VERDICT=ERROR", e instanceof Error ? e.message : e);
  process.exit(1);
});
