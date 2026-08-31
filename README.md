# Agent Terminal

**An open-source, self-hostable alternative to [Bankr](https://bankr.bot)** — an AI agent you talk to in plain language to trade crypto: price checks, swaps, perpetuals, and token launches, from a web terminal, chat bots, CLI, or REST API.

> ⚠️ Paper trading demo — swaps and perps execute at real market prices but settle in a local ledger. No on-chain transactions, no custody, not financial advice.

https://github.com/user-attachments/assets/demo-placeholder
<!-- Record a 15–30s demo (terminal + dashboard) and replace the line above with the real GIF:
     docs/demo.gif — e.g. `npm run dev` then screen-record /terminal and /dashboard -->

## Features

- **Chat terminal** (`/terminal`) — natural language → tool calls (price, swap, perps, launchpad, portfolio)
- **Trader dashboard** (`/dashboard`) — balances, live-mark positions with one-click close, bonding-curve launchpad, trade journal
- **Channel bots** — Telegram + Discord bots that answer mentions (group-chat dealer)
- **REST API** (`/api/v1/*`) — call the tools directly, optional bearer auth
- **CLI** — `npm run cli -- price eth`
- **Hyperliquid perps (paper)** — real-time mid prices, positions with live PnL
- **Token launchpad (paper)** — bonding curve with 1% fee accrual (the "fees fund compute" flywheel)
- **LLM gateway** — OpenAI-compatible proxy with per-key credit metering
- **x402 paid endpoint** — HTTP 402 paywall (exact / base-sepolia) with a demo mode
- **Revenue engine** — swap fees + gateway metering vs. LLM cost → self-sustaining flywheel metric
- **Trade journal + webhooks** — every execution journaled and POSTed out
- **Skills** — drop a file in `skills/` to extend the agent

## Quick start

```bash
git clone https://github.com/bigrender/agent-terminal.git
cd agent-terminal
npm install
cp .env.example .env.local   # set OPENAI_API_KEY (any OpenAI-compatible endpoint works, e.g. Z.ai GLM)
npm run dev -- -p 3000       # landing /, terminal /terminal, dashboard /dashboard
```

Also available:

```bash
npm run bot                  # Telegram bot (TELEGRAM_BOT_TOKEN)
npm run bot:discord          # Discord bot (DISCORD_BOT_TOKEN)
npm run cli -- portfolio     # CLI
npm run test:tools           # tool unit tests
npm run test:parity          # integration tests (live Hyperliquid + RPC)
npm run test:e2e             # full LLM agent E2E (needs API key)
docker build -t agent-terminal .
```

## Architecture

```
interfaces:  web (landing/terminal/dashboard) · telegram · discord · CLI · REST
core:        LLM tool-calling brain (12 tools) · paper ledger · revenue engine
platform:    LLM gateway (metered) · x402 paywall · trade journal · webhooks · skills
```

The same agent core powers every interface. See [`openspec/`](openspec) for the spec-driven development history and [public/report.html](public/report.html) for the full build report.

## Configuration

All keys are optional except the LLM:

| Variable | Purpose |
|---|---|
| `OPENAI_API_KEY` | any OpenAI-compatible endpoint (OpenAI, Z.ai GLM, …) |
| `OPENAI_BASE_URL`, `OPENAI_MODEL` | endpoint/model override |
| `TELEGRAM_BOT_TOKEN`, `DISCORD_BOT_TOKEN` | channel bots |
| `EVM_PRIVATEKEY` | "my wallet" mode for on-chain balance checks |
| `HL_NETWORK` | Hyperliquid `mainnet` (default) or `testnet` |
| `AGENT_API_KEY` | require bearer auth on `/api/v1/*` |
| `GATEWAY_API_KEYS`, `GATEWAY_PRICE_*` | LLM gateway auth + metering rates |
| `X402_PAY_TO` | enable real x402 charging (unset = demo mode) |
| `SWAP_FEE_RATE` | platform swap fee (default 0.005) |
| `WEBHOOK_URL` | outbound trade notifications |

## Disclaimer

This is a demonstration of agent architecture, not an investment product. Trading involves substantial risk. You are responsible for complying with the regulations of your jurisdiction before enabling real-money features.

## License

[MIT](LICENSE)
