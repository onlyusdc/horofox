// 체결 기록 파이프라인 — 저널(data/trades.json) 기록 + 아웃바운드 웹훅(WEBHOOK_URL)
// 저널은 항상, 웹훅은 설정 시. 어느 쪽 실패도 본 거래를 막지 않는다

export async function notifyTrade(event: string, data: unknown): Promise<void> {
  const { recordTrade } = await import("./journal");
  await recordTrade(event, data).catch((e) => console.error("저널 기록 실패:", e));

  const url = process.env.WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event, data, ts: new Date().toISOString() }),
    });
  } catch (e) {
    console.error("webhook 전송 실패:", e instanceof Error ? e.message : e);
  }
}
