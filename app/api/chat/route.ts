import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai";
import { tools } from "@/lib/tools";
import { getModel } from "@/lib/llm";
import { SYSTEM } from "@/lib/prompt";

export const runtime = "nodejs";

export async function POST(req: Request) {
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
