## ADDED Requirements

### Requirement: 시세 조회 툴
에이전트 SHALL getPrice 툴로 코인의 현재 USD 가격을 조회한다. 데이터는 CoinGecko 공개 API를 사용한다.

#### Scenario: ETH 가격 조회
- **WHEN** getPrice가 인자 `coinId: "ethereum"`으로 호출된다
- **THEN** 현재 USD 가격(숫자)을 반환한다

#### Scenario: 알 수 없는 코인 ID
- **WHEN** 존재하지 않는 coinId로 호출된다
- **THEN** 에러를 반환하고 에이전트가 사용자에게 알 수 없는 코인임을 안내한다

### Requirement: 페이퍼 스왑 툴
에이전트 SHALL executeSwap 툴로 로컬 장부에서 한 자산을 다른 자산으로 교환한다. 실행 가격은 호출 시점 실제 시세(CoinGecko)를 사용한다.

#### Scenario: USDC → ETH 스왑
- **WHEN** executeSwap이 `from: "usdc", to: "ethereum", amount: 100`으로 호출되고 장부에 USDC 100 이상이 있다
- **THEN** USDC 100이 차감되고, 시세로 계산된 ETH가 입금되며, 실행 가격과 잔고 변화를 반환한다

#### Scenario: 잔고 부족
- **WHEN** 보유량보다 큰 amount로 호출된다
- **THEN** 장부를 변경하지 않고 잔고 부족 에러를 반환한다

### Requirement: 포트폴리오 조회 툴
에이전트 SHALL getPortfolio 툴로 현재 보유 자산과 각 자산의 USD 평가액을 반환한다.

#### Scenario: 포트폴리오 조회
- **WHEN** getPortfolio가 호출된다
- **THEN** 보유 자산별 수량, 현재가, USD 평가액, 총액을 반환한다

### Requirement: 장부 영속성
시스템 SHALL 장부를 JSON 파일(`data/ledger.json`)에 저장해 서버 재시작 후에도 잔고를 유지한다.

#### Scenario: 재시작 후 잔고 유지
- **WHEN** 스왑 실행 후 서버를 재시작하고 getPortfolio를 호출한다
- **THEN** 재시작 전 잔고가 그대로 조회된다
