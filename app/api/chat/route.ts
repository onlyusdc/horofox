import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai";
import { tools } from "@/lib/tools";
import { getModel } from "@/lib/llm";
import { SYSTEM } from "@/lib/prompt";

export const runtime = "nodejs";

// 공개 데모는 LLM 키가 붙은 채로 열려 있다. 그래서 한 번의 호출이 얼마나 비쌀 수
// 있는지를 코드로 묶어둔다 — 무제한이면 누구든 크레딧을 태울 수 있다.
const MAX_MESSAGES = 20;        // 대화 길이 상한 (컨텍스트 비용)
const MAX_CHARS = 8_000;        // 요청 전체 문자 수 상한
const MAX_OUTPUT_TOKENS = 800;  // 응답 길이 상한
const MAX_STEPS = 5;            // 툴 호출 반복 상한

function tooBig(messages: UIMessage[]): string | null {
  if (!Array.isArray(messages)) return "messages 형식이 잘못됐습니다.";
  if (messages.length > MAX_MESSAGES) return `대화가 너무 깁니다 (최대 ${MAX_MESSAGES}턴).`;
  const chars = JSON.stringify(messages).length;
  if (chars > MAX_CHARS) return `요청이 너무 큽니다 (최대 ${MAX_CHARS}자, 현재 ${chars}자).`;
  return null;
}

export async function POST(req: Request) {
  // 키가 없으면 500 으로 새지 않고 이유를 말한다.
  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      {
        ok: false,
        error:
          "이 인스턴스에는 LLM 키가 설정돼 있지 않아 채팅을 쓸 수 없습니다. " +
          "시세·자산 조회는 /api/v1/* 로 가능합니다. " +
          "채팅까지 쓰려면 OPENAI_API_KEY 를 넣고 직접 호스팅하세요.",
      },
      { status: 503 },
    );
  }

  let messages: UIMessage[];
  try {
    ({ messages } = (await req.json()) as { messages: UIMessage[] });
  } catch {
    return Response.json({ ok: false, error: "JSON 파싱 실패" }, { status: 400 });
  }

  const problem = tooBig(messages);
  if (problem) return Response.json({ ok: false, error: problem }, { status: 413 });

  const result = streamText({
    model: getModel(),
    system: SYSTEM,
    messages: convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(MAX_STEPS),
    maxOutputTokens: MAX_OUTPUT_TOKENS,
  });

  return result.toUIMessageStreamResponse();
}
