# x402-endpoint Specification

## Purpose
TBD - created by archiving change add-bankr-feature-parity. Update Purpose after archive.
## Requirements
### Requirement: x402 유료 엔드포인트
시스템 SHALL `/api/x402`에서 결제 없는 요청에 x402 스펙의 402 응답(exact, base-sepolia 요구 페이로드)을 반환한다.

#### Scenario: 결제 없는 호출
- **WHEN** X-PAYMENT 헤더 없이 GET `/api/x402?tool=price&symbol=eth`
- **THEN** 402 + accepts 페이로드(scheme exact, network base-sepolia, payTo, maxAmountRequired) 반환

### Requirement: 데모 모드
시스템 SHALL `X402_PAY_TO` 미설정 시 데모 모드로 동작해 결제 없이 툴을 실행하고 결과에 demo임을 표시한다.

#### Scenario: 데모 모드 실행
- **WHEN** X402_PAY_TO 미설정 상태로 호출
- **THEN** 툴 실행 결과 + `"mode":"demo"` 반환

