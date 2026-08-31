// 웹 라우트와 봇이 공유하는 LLM 모델 생성 (OpenAI 호환 엔드포인트)
// .chat() — Chat Completions API 강제 (SDK 기본값인 Responses API는 Z.ai 등 외부 엔드포인트에 없음)
import { createOpenAI } from "@ai-sdk/openai";

export function getModel() {
  const provider = createOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || undefined,
  });
  return provider.chat(process.env.OPENAI_MODEL || "gpt-4o-mini");
}
