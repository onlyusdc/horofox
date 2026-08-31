# Design: Agent Terminal MVP

## Context

신규 프로젝트. bankr.bot/terminal의 핵심 구조(LLM 브레인이 자연어를 툴 호출로 변환 → 툴이 실제 동작 실행)를 최소 규모로 재현한다. 사용자는 OpenAI 호환 엔드포인트를 이미 보유할 수 있으므로(Z.ai 등), 프로바이더 종속을 줄인다.

## Goals / Non-Goals

**Goals**
- 자연어 → 툴 호출 → 결과 응답 루프가 동작하는 것
- 시세 조회는 실데이터(CoinGecko), 스왑은 페이퍼 트레이딩(실시세 적용)
- 대화 맥락 유지 (멀티턴)

**Non-Goals**
- 실제 온체인 트랜잭션/지갑 서명 (다음 변경: 테스트넷 스왑)
- 인증/멀티유저, 소셜(X/파캐스터) 커넥터
- 요청에 없는 기능: 리밋 오더, 프라이스 알림, DB

## Decisions

1. **프레임워크: Next.js (App Router) + Vercel AI SDK (`ai`, `@ai-sdk/openai`)**
   - 이유: tool calling 루프와 채팅 스트리밍 UI(`useChat`)가 거의 공짜. 대안인 순수 API 구현은 스트리밍/툴 루프를 직접 작성해야 해서 MVP에 과함.
2. **LLM 프로바이더: OpenAI 호환 API + 환경변수 교체 가능**
   - `OPENAI_API_KEY` 필수, `OPENAI_BASE_URL`/`OPENAI_MODEL` 선택. Z.ai·OpenAI 등 어디든 연결.
3. **스왑 실행: 페이퍼 트레이딩(로컬 장부)**
   - 이유: 실제 테스트넷 스왑은 RPC·테스트 토큰·패킷 셋업이 필요해 MVP 병목. 실시세(CoinGecko)로 체결하면 "에이전트가 스왑을 실행한다"는 핵심 경험이 그대로 검증된다. 툴 인터페이스는 유지되므로 이후 내부만 실제 서명자로 교체.
4. **장부 영속성: JSON 파일 (`data/ledger.json`)**
   - 이유: DB는 과함. 십수 줄의 read/write로 재시작 간 잔고 유지. 단일 유저 전제.
5. **UI: xterm.js 미사용, 채팅 UI + 모노스페이스 다크 테마**
   - 이유: 툴 실행 상태 표시(로딩/결과)를 `useChat` 데이터 스트림으로 처리하는 게 간단. 터미널 감성은 스타일로 충분.

## Risks / Trade-offs

- [CoinGecko 레이트리imit (무료 티어)] → 툴 결과에 짧은 메모리 캐시(30초) 적용
- [페이퍼 스왑은 실제 체결과 다름 (슬리피지/가스 없음)] → 결과에 "페이퍼 실행" 명시. 실제 실행은 다음 변경에서 교체
- [LLM 키 미설정 시 앱이 동작 안 함] → 서버 기동 시 키 없으면 UI에 안내 문구 표시

## Open Questions

- 실제 테스트넷은 Base Sepolia로 할지 Solana Devnet으로 할지 (다음 변경에서 결정)
