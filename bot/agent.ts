// 에이전트 실행기 — 웹과 같은 코어(툴·장부)를 텍스트 인/아웃으로만 사용
import { generateText, stepCountIs, type ModelMessage } from "ai";
import { tools } from "../lib/tools";
import { getModel } from "../lib/llm";
import { SYSTEM } from "../lib/prompt";

export async function runAgent(history: ModelMessage[]): Promise<string> {
  const { text } = await generateText({
    model: getModel(),
    system: SYSTEM,
    messages: history,
    tools,
    stopWhen: stepCountIs(5),
  });
  return text;
}
