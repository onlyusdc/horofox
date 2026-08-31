# Tasks: add-agent-terminal-mvp

## 1. 스캐폴딩

- [x] 1.1 Next.js 앱 생성 (TypeScript, App Router, Tailwind) + `ai`, `@ai-sdk/openai` 설치
- [x] 1.2 환경변수 템플릿 `.env.example` 작성 (`OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL`)

## 2. 에이전트 툴

- [x] 2.1 CoinGecko 시세 조회 함수 + 30초 캐시 (툴 단독 테스트로 검증)
- [x] 2.2 JSON 장부 모듈 (`data/ledger.json` 읽기/쓰기, 기본 잔고 시딩)
- [x] 2.3 툴 3종 정의: `getPrice`, `executeSwap` (페이퍼 체결), `getPortfolio`

## 3. 에이전트 루트 + UI

- [x] 3.1 `/api/chat` 라우트: `streamText` + 툴 루프 (`stopWhen: stepCountIs(5)`)
- [x] 3.2 터미널 스타일 채팅 UI: `useChat`, 툴 호출 상태 표시, 키 미설정 안내

## 4. 검증

- [x] 4.1 `npm run build` 성공
- [x] 4.2 툴 단독 실행 스크립트로 3개 툴 동작 확인 (가격 조회 실데이터, 스왑 장부 반영, 포트폴리오 평가)
- [x] 4.3 MVP 성공 기준 체크: "ETH 가격 알려줘" / "100 USDC를 ETH로 바꿔줘" / "그거 다시 팔아줘" (LLM 키 있는 경우)
