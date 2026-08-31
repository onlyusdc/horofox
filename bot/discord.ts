// 디스코드 커넥터 — 멘션/DM에 에이전트 응답 (텔레그램과 동일 패턴)
// 실행: npm run bot:discord   (필요: .env.local의 DISCORD_BOT_TOKEN)
import "../lib/env";
import { Client, Events, GatewayIntentBits, type Message } from "discord.js";
import type { ModelMessage } from "ai";
import { runAgent } from "./agent";

const TOKEN = process.env.DISCORD_BOT_TOKEN;

function fail(msg: string): never {
  console.error(`❌ ${msg}`);
  process.exit(1);
}

if (!TOKEN) {
  fail(
    "DISCORD_BOT_TOKEN이 없습니다.\n" +
      "1) https://discord.com/developers/applications → New Application → Bot\n" +
      "2) MESSAGE CONTENT INTENT 켜기, 토큰 복사\n" +
      "3) .env.local 에 추가: DISCORD_BOT_TOKEN=...\n" +
      "4) 봇을 서버에 초대 후 npm run bot:discord 재실행"
  );
}

const MEMORY_LIMIT = 16;
const history = new Map<string, ModelMessage[]>(); // channelId → 최근 텍스트 턴

function remember(channelId: string, turn: ModelMessage) {
  const h = history.get(channelId) ?? [];
  h.push(turn);
  history.set(channelId, h.slice(-MEMORY_LIMIT));
}

async function handleMessage(msg: Message, botUser: { id: string }) {
  if (msg.author.bot) return;
  const dm = !msg.guild;
  const mentioned = msg.mentions.users.has(botUser.id);
  if (!dm && !mentioned) return;

  let text = msg.content.replace(/<@!?\d+>/g, "").trim();
  if (!text) return;

  remember(msg.channel.id, { role: "user", content: text });
  try {
    if ("sendTyping" in msg.channel) await msg.channel.sendTyping();
    const answer = await runAgent(history.get(msg.channel.id)!);
    remember(msg.channel.id, { role: "assistant", content: answer });
    for (let i = 0; i < answer.length; i += 1900) {
      await msg.reply(answer.slice(i, i + 1900));
    }
  } catch (e) {
    await msg.reply(`에러: ${e instanceof Error ? e.message : String(e)}`);
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
});

client.once(Events.ClientReady, (c) => {
  console.log(`🤖 agent-terminal 디스코드 봇 기동: ${c.user.tag}`);
});

client.on(Events.MessageCreate, (msg) => {
  handleMessage(msg, { id: client.user!.id }).catch((e) => console.error(e));
});

client.login(TOKEN).catch((e) => fail(`로그인 실패: ${e instanceof Error ? e.message : String(e)}`));
