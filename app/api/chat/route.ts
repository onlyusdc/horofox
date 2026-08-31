import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai";
import { tools } from "@/lib/tools";
import { getModel } from "@/lib/llm";
import { SYSTEM } from "@/lib/prompt";

export const runtime = "nodejs";

export async function POST(req: Request) {
  // LLM 키가 없으면 500 으로 새지 않고 이유를 말한다.
  // 공개 데모는 키 없이 도는데, 500 은 "고장난 서비스"로 보인다.
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

  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: getModel(),
    system: SYSTEM,
    messages: convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(5),
  });

  return result.toUIMessageStreamResponse();
}
