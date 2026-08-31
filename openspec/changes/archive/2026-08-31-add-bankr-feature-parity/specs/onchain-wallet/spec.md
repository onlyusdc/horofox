## ADDED Requirements

### Requirement: 온체인 잔액 조회
에이전트 SHALL viem 공개 RPC로 Base Sepolia 주소의 ETH 잔액을 조회한다 (키 불필요).

#### Scenario: 주소 잔액 조회
- **WHEN** onchainBalance("0x…") 호출
- **THEN** ETH 잔액 반환

### Requirement: 내 지갑 모드
시스템 SHALL `EVM_PRIVATEKEY` 설정 시 해당 지갑 주소를 기본 대상으로 사용한다.

#### Scenario: 키 설정 후 주소 생략
- **WHEN** EVM_PRIVATEKEY 설정 상태에서 onchainBalance() 주소 생략
- **THEN** 해당 키 지갑의 잔액 반환
