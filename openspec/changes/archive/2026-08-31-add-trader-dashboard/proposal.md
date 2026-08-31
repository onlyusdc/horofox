# Add: Trader Dashboard

## Why

"채팅 없이도 도는 시스템"을 눈으로 보여주는 트레이더 UI. 이미 열려있는 REST API(`/api/v1/*`) 위에서만 만들어 코어 무수정을 증명하고, Bankr 클론(대화형)에 트레이더/관리자용 얼굴을 추가한다.

## What Changes

- `/dashboard`: 잔고 카드, 퍼펫 포지션 테이블(청산 버튼), 런치패드 토큰 테이블(매매 폼), 스왑 폼, 체결 내역 — 5초 폴링
- 체결 저널: 모든 체결을 `data/trades.json`에 기록 + `GET /api/v1/trades` 조회 (웹훅과 같은 지점에서 기록)
- 랜딩 네비에 대시보드 링크

## Capabilities

### New Capabilities

- `trade-journal`: 체결 이벤트 로컬 저널링과 조회
- `dashboard`: 비채팅 매매 UI (REST 기반)

### Modified Capabilities

(없음)

## Impact

- 신규: `lib/journal.ts`, `app/dashboard/`, REST `trades` 케이스
- 수정: `lib/webhook.ts`(저널 병합), `app/page.tsx`(nav), `app/globals.css`(대시보드 스타일)
