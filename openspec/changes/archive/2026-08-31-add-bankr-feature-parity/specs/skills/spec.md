## ADDED Requirements

### Requirement: 스킬 파일 기반 확장
시스템 SHALL `skills/*.ts` 파일이 내보낸 툴을 에이전트 툴 레지스트리에 병합한다. 설치는 파일 추가 + `skills/index.ts`에 import 한 줄이다.

#### Scenario: 예시 스킬 로드
- **WHEN** 에이전트 기동 (skills/index.ts에 gas 스킬 import됨)
- **THEN** getGasPrice 툴 사용 가능
