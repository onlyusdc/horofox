# token-launchpad Specification

## Purpose
TBD - created by archiving change add-bankr-feature-parity. Update Purpose after archive.
## Requirements
### Requirement: 페이퍼 토큰 발행
에이전트 SHALL launchToken으로 가상 본딩커브(x·y=k)를 가진 토큰을 발행한다. 초기 준비금: 토큰 1,000,000 / USDC 100.

#### Scenario: 토큰 발행
- **WHEN** launchToken("Demo", "DEMO")
- **THEN** 토큰 등록 및 초기 가격(0.0001 USDC) 반환

### Requirement: 본딩커브 매매와 수수료 적립
에이전트 SHALL buyToken/sellToken으로 커브 가격에 매매하며, 거래액의 1%를 토큰별 수수료로 적립한다(컴퓨팅비 충당 루프 시연).

#### Scenario: 매수 후 가격 상승 확인
- **WHEN** buyToken("DEMO", 10 USDC)
- **THEN** 토큰 수령, 커브 가격 상승, USDC 차감

#### Scenario: 수수료 조회
- **WHEN** getLaunchpad 호출
- **THEN** 토큰별 가격·적립 수수료 반환

