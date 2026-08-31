# trade-journal Specification

## Purpose
TBD - created by archiving change add-trader-dashboard. Update Purpose after archive.
## Requirements
### Requirement: 체결 저널
시스템 SHALL 모든 체결(스왑·퍼펫·런치 매매)을 `data/trades.json`에 최근 200건으로 기록하고, `GET /api/v1/trades`로 최신순 조회할 수 있게 한다.

#### Scenario: 스왑 체결 기록
- **WHEN** 스왑 체결
- **THEN** trades.json에 `{event, data, ts}` 레코드 추가되고 API로 조회된다

