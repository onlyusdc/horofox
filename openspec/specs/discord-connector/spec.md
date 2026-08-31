# discord-connector Specification

## Purpose
TBD - created by archiving change add-bankr-feature-parity. Update Purpose after archive.
## Requirements
### Requirement: 디스코드 커넥터
시스템 SHALL `DISCORD_BOT_TOKEN`이 있으면 디스코드에서 멘션/DM 메시지에 에이전트로 응답하고, 없으면 발급 방법을 안내 후 종료한다.

#### Scenario: 토큰 없이 기동
- **WHEN** 토큰 없이 `npm run bot:discord` 실행
- **THEN** 개발자 포털 안내 출력 후 0이 아닌 코드로 종료

