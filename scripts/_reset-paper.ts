// 페이퍼 상태 초기화.
//
// 원장·포지션·토큰은 테스트가 쓰면서 줄어든다. 초기화하지 않으면
// 몇 번 돌린 뒤 "잔고 부족"·"이미 발행됨"으로 깨지고, 그건 코드 결함이 아니라
// 테스트가 자기 흔적을 안 치운 것이다. 반복 실행이 안 되는 테스트는 게이트로 못 쓴다.
//
// users.json 과 quota.json 은 건드리지 않는다 — 각자의 테스트가 관리한다.

import fs from "node:fs/promises";
import path from "node:path";

const DATA = path.join(process.cwd(), "data");

/** lib/ledger.ts 의 DEFAULT_LEDGER 와 같아야 한다. */
const FRESH: Record<string, unknown> = {
  "ledger.json": { balances: { usdc: 1000 } },
  "perps.json": { positions: [] },
  "tokens.json": { tokens: {} },
};

export async function resetPaperState(): Promise<void> {
  await fs.mkdir(DATA, { recursive: true }).catch(() => {});
  for (const [file, empty] of Object.entries(FRESH)) {
    await fs
      .writeFile(path.join(DATA, file), JSON.stringify(empty, null, 2) + "\n", "utf8")
      .catch(() => {}); // 읽기 전용 환경에서는 조용히 넘어간다 (테스트 헬퍼일 뿐)
  }
}
