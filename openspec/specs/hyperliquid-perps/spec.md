# hyperliquid-perps Specification

## Purpose
TBD - created by archiving change add-bankr-feature-parity. Update Purpose after archive.
## Requirements
### Requirement: Hyperliquid 실시간 시세
에이전트 SHALL Hyperliquid 공개 info API로 코인 mid 가격을 조회한다 (키 불필요, `HL_NETWORK`로 mainnet/testnet 선택).

#### Scenario: BTC 시세
- **WHEN** getPerpPrice("BTC") 호출
- **THEN** mid 가격 숫자 반환

### Requirement: 페이퍼 퍼펫 포지션
에이전트 SHALL openPerp/closePerp/getPerpPositions로 롱/숏 포지션을 열고 닫으며, PnL은 실시간 mark 대비 계산하고 결과에 paper임을 명시한다.

#### Scenario: 롱 포지션 열고 닫기
- **WHEN** openPerp(ETH, long, 100 USDC, 5x) 후 closePerp(ETH)
- **THEN** 진입가→종가 차익 PnL 반환, 포지션 제거

#### Scenario: 잔고 부족 증거금
- **WHEN** 장부 USDC보다 큰 증거금으로 openPerp
- **THEN** 거부하고 잔고 부족 안내

