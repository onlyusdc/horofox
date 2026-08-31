# Add: Agent Terminal MVP

## Why

bankr.bot/terminal 같은 "자연어 한 줄로 지갑·스왑·시세를 처리하는 AI 에이전트 터미널"을 직접 구현해 LLM tool calling + 온체인/시세 실행 구조를 검증하고 싶다. 프로토타입으로 동작을 확인해야 다음 단계(실제 테스트넷 스왑, 소셜 봇)를 결정할 수 있다.

## What Changes

- 신규 Next.js 앱: 터미널 스타일 채팅 UI (스트리밍 응답)
- 에이전트 API 라우트: OpenAI 호환 LLM + tool calling 루프
- 툴 3종: 시세 조회(CoinGecko 공개 API), 페이퍼 스왑(로컬 장부 실행), 포트폴리오 조회
- 데모용 로컬 장부: JSON 파일 저장, 서버 재시작해도 잔고 유지

## Capabilities

### New Capabilities

- `chat-terminal`: 자연어 채팅 터미널 UI, 스트리밍 응답, 툴 실행 결과 표시
- `agent-tools`: 시세 조회 / 페이퍼 스왑 / 포트폴리오 툴과 JSON 장부

### Modified Capabilities

(없음 — 신규 프로젝트)

## Impact

- 신규 코드베이스 (`agent-terminal/`)
- 의존성: `next`, `ai`, `@ai-sdk/openai`
- 외부 API: CoinGecko simple price (키 불필요)
- 환경변수: `OPENAI_API_KEY` (필수), `OPENAI_BASE_URL`·`OPENAI_MODEL` (선택 — Z.ai 등 OpenAI 호환 엔드포인트로 교체 가능)
- 실제 온체인 실행(테스트넷 스왑)은 이번 변경 범위 밖 — 다음 변경으로 진행
