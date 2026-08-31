// 텔레그램 커넥터 — getUpdates 롱폴링 (웹훅/공개 URL 불필요)
// 실행: npm run bot   (필요: .env.local의 TELEGRAM_BOT_TOKEN + OPENAI_API_KEY)
import "../lib/env";
import type { ModelMessage } from "ai";
import { runAgent } from "./agent";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API = TOKEN ? `https://api.telegram.org/bot${TOKEN}` : "";

const MEMORY_LIMIT = 16;
const history = new Map<number, ModelMessage[]>(); // chatId → 최근 텍스트 턴

function fail(msg: string): never {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

if (!TOKEN) {
  fail(
    "TELEGRAM_BOT_TOKEN이 없습니다.\n" +
      "1) 텔레그램에서 @BotFather → /newbot 으로 봇 생성, 토큰 복사\n" +
      "2) .env.local 에 추가: TELEGRAM_BOT_TOKEN=123456:ABC...\n" +
      "3) OPENAI_API_KEY도 .env.local에 필요\n" +
      "4) npm run bot 재실행"
  );
}

async function tg(method: string, body: Record<string, unknown>) {
  const res = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { ok: boolean; error_code?: number; description?: string; result?: unknown };
  if (!json.ok) throw new Error(`텔레그램 ${method} 실패 (${json.error_code}): ${json.description}`);
  return json.result;
}

function remember(chatId: number, turn: ModelMessage) {
  const h = history.get(chatId) ?? [];
  h.push(turn);
  history.set(chatId, h.slice(-MEMORY_LIMIT));
}

async function reply(chatId: number, text: string) {
  // 한도 4096자 — 여유 두고 4000자 청크
  for (let i = 0; i < text.length; i += 4000) {
    await tg("sendMessage", { chat_id: chatId, text: text.slice(i, i + 4000) });
  }
}

interface TgMessage {
  chat: { id: number; type: string };
  text?: string;
}

async function handleMessage(msg: TgMessage, botUsername: string) {
  const chatId = msg.chat.id;
  const isGroup = msg.chat.type === "group" || msg.chat.type === "supergroup";
  let text = (msg.text ?? "").trim();
  if (!text) return;

  if (isGroup) {
    const at = `@${botUsername.toLowerCase()}`;
    if (!text.toLowerCase().includes(at)) return; // 멘션 없는 그룹 대화 무시
    text = text.replace(new RegExp(at, "ig"), "").trim();
    if (!text) return;
  }

  await tg("sendChatAction", { chat_id: chatId, action: "typing" }).catch(() => {});
  remember(chatId, { role: "user", content: text });

  try {
    const answer = await runAgent(history.get(chatId)!);
    remember(chatId, { role: "assistant", content: answer });
    await reply(chatId, answer);
  } catch (e) {
    await reply(chatId, `에러: ${e instanceof Error ? e.message : String(e)}`);
  }
}

async function main() {
  const me = (await tg("getMe", {})) as { username: string };
  console.log(`🤖 agent-terminal 봇 기동: @${me.username} (롱폴링)`);

  let offset = 0;
  for (;;) {
    let updates: { update_id: number; message?: TgMessage }[] = [];
    try {
      updates = (await tg("getUpdates", { offset, timeout: 25 })) as typeof updates;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("409")) {
        fail("다른 getUpdates 인스턴스가 실행 중입니다 (409). 기존 프로세스를 종료하세요.");
      }
      console.error(msg, "→ 3초 후 재시도");
      await new Promise((r) => setTimeout(r, 3000));
      continue;
    }

    for (const u of updates) {
      offset = u.update_id + 1;
      if (u.message?.text) await handleMessage(u.message, me.username);
    }
  }
}

main().catch((e) => fail(e instanceof Error ? e.message : String(e)));
