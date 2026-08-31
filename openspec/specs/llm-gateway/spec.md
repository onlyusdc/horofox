# llm-gateway Specification

## Purpose
TBD - created by archiving change add-bankr-feature-parity. Update Purpose after archive.
## Requirements
### Requirement: OpenAI 호환 프록시
시스템 SHALL `/api/gateway/v1/chat/completions`로 OpenAI 호환 요청을 업스트림으로 프록시하고, `GATEWAY_API_KEYS`의 Bearer 키로 인증한다.

#### Scenario: 키 없는 호출
- **WHEN** Authorization 없이 POST
- **THEN** 401 반환

#### Scenario: 프록시 성공
- **WHEN** 유효 키로 chat/completions 요청
- **THEN** 업스트림 응답 그대로 반환

### Requirement: 사용량 기록
시스템 SHALL 프록시 성공 시 모델·토큰 사용량을 `data/usage.json`에 누적 기록한다.

#### Scenario: 사용량 적산
- **WHEN** 프록시 호출 성공 (usage 필드 포함 응답)
- **THEN** usage.json에 레코드 추가

