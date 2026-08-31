# Tasks: add-telegram-connector

## 1. 준비

- [x] 1.1 dotenv 설치 + `npm run bot` 스크립트 추가
- [x] 1.2 코어 공용화: `lib/llm.ts`·`lib/prompt.ts` 추출, `app/api/chat/route.ts` 교체

## 2. 텔레그램 커넥터

- [x] 2.1 `bot/agent.ts`: 대화 히스토리 → `generateText` → 최종 텍스트
- [x] 2.2 `bot/telegram.ts`: getUpdates 롱폴링 루프, 토큰 누락/409 안내
- [x] 2.3 그룹 멘션 필터 + 개인 채팅 응답
- [x] 2.4 채팅방별 메모리(상한 16) + 타이핑 표시 + 4000자 청크 전송

## 3. 검증

- [x] 3.1 토큰 없이 기동 → 발급 안내 출력 후 종료 확인
- [ ] 3.2 (키·토큰 필요) 개인 채팅: 시세 조회 / 스왑 / "그거 다시 팔아줘" 3기준 검증
