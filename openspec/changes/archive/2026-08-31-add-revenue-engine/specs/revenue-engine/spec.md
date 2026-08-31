## ADDED Requirements

### Requirement: 스왑 수수료
시스템 SHALL 스왑 체결 시 체결 USD 가치의 `SWAP_FEE_RATE`(기본 0.5%)를 플랫폼 수익으로 적립하고 결과에 명시한다.

#### Scenario: 수수료 적립
- **WHEN** $100 상당 스왑 체결
- **THEN** revenue에 $0.5 적립되고 결과에 platformFeeUsdc 포함

### Requirement: 게이트웨이 크레딧 과금
시스템 SHALL 게이트웨이 키별 크레딧 잔액(data/credits.json)을 유지하고, 호출 성공 시 토큰 사용량 × 요율(env 기본 prompt $0.001/1K, completion $0.004/1K)을 차감한다. 잔액이 없으면 402와 탑업 안내를 반환한다. 탑업은 데모 엔드포인트(POST /api/gateway/topup)로 한다.

#### Scenario: 크레딧 없는 키
- **WHEN** 잔액 없는 키로 호출
- **THEN** 402 + 탑업 안내

#### Scenario: 과금 차감
- **WHEN** 크레딧 있는 키로 성공 호출 (usage 포함)
- **THEN** 잔액 차감 + revenue에 기록

### Requirement: 플라이휠 요약
시스템 SHALL GET /api/v1/revenue에서 총 수익(스왑+런치패드+게이트웨이), LLM 비용 추정, 순수익을 반환한다.

#### Scenario: 수익 요약
- **WHEN** revenue 조회
- **THEN** 카테고리별 수익과 llmCostUsdc, netUsdc 포함
