#!/usr/bin/env bash
# Cloudflare 배포.
#
# 왜 이 스크립트가 필요한가: Next 는 빌드 시 `.env.local` 을 읽어 `process.env.X`
# 참조를 **번들에 인라인**한다. 그대로 배포하면 API 키가 Worker 코드 안에 박힌다.
# (실제로 한 번 그렇게 나갔다.) 그래서 빌드 동안 .env.local 을 치워둔다.
#
# 운영 시크릿은 빌드가 아니라 `wrangler secret put` 으로 주입할 것.
set -euo pipefail
cd "$(dirname "$0")/.."

RESTORE=0
if [ -f .env.local ]; then
  mv .env.local .env.local.build-hidden
  RESTORE=1
fi
cleanup() { [ "$RESTORE" = 1 ] && mv .env.local.build-hidden .env.local || true; }
trap cleanup EXIT

echo "▸ 빌드 (.env.local 비활성)"
npx opennextjs-cloudflare build

echo "▸ 런타임 상태 파일 제거 (혹시 추적에 걸렸을 경우 대비)"
find .open-next -type d -name data -prune -exec rm -rf {} + 2>/dev/null || true
find .open-next -name ".env*" -delete 2>/dev/null || true

echo "▸ 번들에 시크릿이 박혔는지 검사"
LEAK=0
if grep -rqE '"(OPENAI_API_KEY|GATEWAY_API_KEYS|HL_TRADER_KEY|USER_ENCRYPTION_KEY|TELEGRAM_BOT_TOKEN)":"[^"]{8,}"' .open-next/ 2>/dev/null; then LEAK=1; fi
if find .open-next -path "*/data/*.json" | grep -q .; then
  echo "✗ 번들에 런타임 상태(data/)가 남아 있습니다." >&2; LEAK=1
fi
if [ "$LEAK" = 1 ]; then
  echo "✗ 번들에 시크릿이 있습니다. 배포를 중단합니다." >&2
  grep -rlE '"(OPENAI_API_KEY|GATEWAY_API_KEYS)":"[^"]{8,}"' .open-next/ >&2
  exit 1
fi
echo "  ✓ 시크릿 없음"

echo "▸ 배포"
npx wrangler deploy
