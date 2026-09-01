"use client";

import { useChat } from "@ai-sdk/react";
import { useState } from "react";
import type { ToolUIPart, UIMessage } from "ai";

const EXAMPLES = [
  "ETH 가격 알려줘",
  "100 USDC를 ETH로 바꿔줘",
  "내 포트폴리오 보여줘",
];

function toolLabel(type: string, state: ToolUIPart["state"]): string {
  const name = type.slice("tool-".length);
  if (state === "output-available") return `✓ ${name}`;
  if (state === "output-error") return `✗ ${name} 실패`;
  return `⏳ ${name} 실행 중…`;
}

export default function Chat({ hasKey }: { hasKey: boolean }) {
  const { messages, sendMessage, status, error } = useChat();
  const [input, setInput] = useState("");

  const busy = status === "submitted" || status === "streaming";

  const submit = () => {
    const text = input.trim();
    if (!text || busy) return;
    sendMessage({ text });
    setInput("");
  };

  const renderPart = (part: UIMessage["parts"][number], i: number) => {
    if (part.type === "text") {
      return (
        <span key={i} className="text">
          {part.text}
        </span>
      );
    }
    if (part.type.startsWith("tool-")) {
      const t = part as ToolUIPart;
      const cls = t.state === "output-error" ? "tool-chip error" : t.state === "output-available" ? "tool-chip" : "tool-chip running";
      return (
        <span key={i} className={cls}>
          {toolLabel(part.type, t.state)}
        </span>
      );
    }
    return null;
  };

  return (
    <div className="terminal">
      <header>
        <span className="dot" />
        <h1>onlyusdc</h1>
        <span>— 자연어 트레이딩 에이전트 (페이퍼 트레이딩)</span>
      </header>

      <div className="messages">
        {messages.length === 0 && (
          <div className="hint">
            <p className="empty">에이전트에게 자연어로 지시하세요. 예시:</p>
            <ul>
              {EXAMPLES.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={`msg ${m.role}`}>
            <span className="role">{m.role === "user" ? "you>" : "agent>"}</span>
            {m.parts.map(renderPart)}
          </div>
        ))}

        {busy && (
          <div className="msg assistant">
            <span className="role">agent&gt;</span>
            <span className="hint">…</span>
          </div>
        )}

        {error && (
          <div className="error-line">에러: {error.message}</div>
        )}
      </div>

      {!hasKey && (
        <div className="notice">
          OPENAI_API_KEY가 설정되지 않았습니다. .env.local 을 만들고 키를 넣은 뒤 서버를
          다시 시작하세요. (OPENAI_BASE_URL로 Z.ai 등 OpenAI 호환 엔드포인트 사용 가능)
        </div>
      )}

      <div className="composer">
        <span className="prompt-mark">$</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) submit();
          }}
          placeholder="명령어를 입력하세요…"
          autoFocus
        />
        <button onClick={submit} disabled={busy}>
          {busy ? "…" : "전송"}
        </button>
      </div>
    </div>
  );
}
