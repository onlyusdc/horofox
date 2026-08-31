## ADDED Requirements

### Requirement: 체결 저널
시스템 SHALL 모든 체결(스왑·퍼펫·런치 매매)을 `data/trades.json`에 최근 200건으로 기록하고, `GET /api/v1/trades`로 최신순 조회할 수 있게 한다.

#### Scenario: 스왑 체결 기록
- **WHEN** 스왑 체결
- **THEN** trades.json에 `{event, data, ts}` 레코드 추가되고 API로 조회된다

## ADDED Requirements (dashboard)

### Requirement: 대시보드 UI
시스템 SHALL `/dashboard`에서 잔고(USD 평가), 퍼펫 포지션(청산 버튼), 런치패드 토큰(매수/매도), 스왑 폼, 체결 내역을 5초 주기로 갱신해 보여준다. 모든 동작은 REST API를 통해서만 이뤄진다.

#### Scenario: 청산 버튼
- **WHEN** 포지션 행의 청산 버튼 클릭
- **THEN** POST /api/v1/close 실행 후 목록이 갱신된다
