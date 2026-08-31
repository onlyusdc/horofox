## ADDED Requirements

### Requirement: 랜딩 페이지
시스템 SHALL `/`에서 마케팅 플랜의 1순위 훅과 기능 요약, API 가격, 터미널 진입 링크를 제공한다.

#### Scenario: 랜딩에서 터미널 진입
- **WHEN** `/` 접속 후 CTA 클릭
- **THEN** `/terminal`에서 채팅 터미널이 열린다

## ADDED Requirements (webhooks)

### Requirement: 체결 웹훅
시스템 SHALL `WEBHOOK_URL` 설정 시 스왑·퍼펫·런치 매매 체결 이벤트를 POST로 알린다. 웹훅 실패는 본 거래에 영향을 주지 않는다.

#### Scenario: 스왑 체결 알림
- **WHEN** WEBHOOK_URL 설정 상태에서 스왑 체결
- **THEN** 해당 URL로 `{event, data, ts}` JSON이 전송된다
