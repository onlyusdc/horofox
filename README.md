# Agent Terminal

**An open-source, self-hostable alternative to [Bankr](https://bankr.bot)** — an AI agent you talk to in plain language: price checks, swaps, perpetuals and token launches, from a web terminal, chat bots, CLI, or REST API. Unlike Bankr, it reaches Hyperliquid's HIP-3 markets, so "buy Nvidia" is a real tokenized equity perp rather than a meme coin named after one.

> ⚠️ Swaps and the launchpad are paper — they price against real markets but settle in a local ledger. Perps sign real Hyperliquid orders when `HL_MODE=live`. No custody, not financial advice.

## The edge: the agent pays its own bills out of trade flow

Bankr's flywheel is **mint a token → collect its swap fees → fund the agent's inference**. Two things are wrong with copying it:

1. **Most of that fee isn't theirs.** Their own terminal states the pool charges a **0.7% swap fee, 95% of which goes to the token's creator** — leaving roughly 1/19 for the platform. The launchpad is customer acquisition, not the revenue.
2. **It's tied to the meme-coin cycle.** Launch revenue is not a floor; it fell **~92% from peak** in the public monthly data.

We run the same loop on **trading** instead of **minting**:

```
you trade  →  a builder code rides on the order (0.1%)
           →  Hyperliquid pays that fee on-chain
           →  the fee converts into LLM credits
           →  the agent pays for its own inference
```

Why this is defensible:

- **The protocol pays it, not a middleman.** Builder codes are a Hyperliquid primitive, so it isn't the kind of fee a competitor can undercut to 0% as a growth tactic.
- **No token to launch.** No contract, no audit, no unlock schedule, no cycle risk.
- **Bankr routes Hyperliquid trades and doesn't collect this.** Their Hyperliquid reference (`skills/bankr/references/hyperliquid.md`, 192 lines) mentions "builder" exactly once — in the phrase *"HIP-3 builder-deployed dexes"* — and never as a fee they take.

Where it lives in the code — three pieces that used to be unconnected:

| Piece | File | Job |
| --- | --- | --- |
| Fee attachment | `lib/hl/core.ts` | every order action carries `builder`; the field is non-optional |
| On-chain read | `lib/hl/revenue.ts` | reads cumulative builder rewards from Hyperliquid |
| Conversion | `lib/selffund.ts` | turns settled fees into LLM credits, **idempotently** |

Settlement is idempotent by ledger: `data/selffund.json` records the cumulative amount already converted, so calling it twice grants nothing the second time. Concurrent settlements (an operator double-clicking, or a cron overlapping a manual run) are serialized in-process, so two simultaneous calls grant one payout between them rather than two. Rounding is always down, nothing is granted when the filesystem is read-only, and a shrinking on-chain figure never claws credits back.

```bash
npx tsx scripts/test-selffund.ts        # 25 assertions, incl. double-spend and race attempts
npx tsx scripts/test-selffund.ts --api  # 15 assertions: endpoint + operator-only settlement
```

### Coverage, measured rather than claimed

`GET /api/v1/metrics` counts what we can actually place orders against, at request time:

```
280 assets = 177 crypto (main perp dex) + 103 HIP-3
             HIP-3 = 92 tokenized equities + 11 indices & commodities
             sample: TSLA NVDA HOOD INTC PLTR COIN META AAPL
```

Reproduce with `npx tsx scripts/test-coverage.ts`. The test also fails if a constant total is reintroduced into the UI — the landing page previously composed `177 + hip3` client-side, and a hardcoded number is not evidence.

### Public metrics never sum real and paper

`/metrics` publishes the numbers, but `live` and `paper` are separate objects that **share no field names**, and there is no combined total anywhere in the payload — you cannot add them by accident because the shape doesn't offer it. `scripts/test-public-metrics.ts` asserts exactly that, including that no exposed value equals a live+paper sum.

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
