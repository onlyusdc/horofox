# agent-api Specification

## Purpose
TBD - created by archiving change add-bankr-feature-parity. Update Purpose after archive.
## Requirements
### Requirement: REST API로 툴 직접 호출
시스템 SHALL `/api/v1/*` 엔드포인트로 가격·스왑·포트폴리오·퍼펫·런치패드 기능을 LLM 없이 호출할 수 있게 한다. `AGENT_API_KEY` 설정 시 Bearer 인증을 요구한다.

#### Scenario: 가격 조회
- **WHEN** GET `/api/v1/price?symbol=eth` 요청
- **THEN** 200과 현재가 JSON 반환

#### Scenario: 페이퍼 스왑
- **WHEN** POST `/api/v1/swap` `{from,to,amount}`
- **THEN** 체결 결과 반환 및 장부 반영

#### Scenario: 인증 실패
- **WHEN** `AGENT_API_KEY` 설정 상태에서 키 없이 요청
- **THEN** 401 반환

### Requirement: CLI
시스템 SHALL `npm run cli`로 동일 기능을 터미널에서 제공한다 (price/swap/portfolio/perp/perps/close/launch/buy/sell/bal).

#### Scenario: CLI 가격 조회
- **WHEN** `npm run cli -- price eth` 실행
- **THEN** 현재가 출력

