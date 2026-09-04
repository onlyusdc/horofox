# ETHOnline 2026 — Continuity Track disclosure

This file exists because ETHGlobal's rules require it:

> "you must disclose any pre-existing work in writing to the ETHGlobal team and include full details
> in your submission (repo history, video, and description)."

> "Continuity-track submissions must clearly document what work existed before the hackathon and must
> include substantive new features, improvements, or functionality developed during the event."

Source: <https://ethglobal.com/rules>

## The line

**Everything up to and including commit `0b5b668` (2026-09-02) is pre-existing work.**
It was written before ETHOnline 2026 began on 2026-09-04.

```bash
git log --oneline 0b5b668        # pre-existing
git log --oneline 0b5b668..HEAD  # built during the hackathon
```

Judges should read the second command's output as the submission. Everything in the first is context.

## What existed before the event

The repository was an open-source agent that trades Hyperliquid perpetuals through chat, plus the
plumbing around it. Concretely, as of `0b5b668`:

| Area | Files | What it did |
| --- | --- | --- |
| Chat agent | `bot/agent.ts`, `app/terminal/` | One shared brain (`runAgent`) behind terminal, Telegram, Discord, CLI |
| Hyperliquid engine | `lib/hl/` | Order building, asset resolution across 4 HIP-3 dexes, builder-code attachment |
| x402 paid API | `app/api/x402/route.ts` | HTTP 402 paywall over market tools, priced per call |
| Self-funding loop | `lib/selffund.ts` | Converts on-chain builder fees into LLM credits, idempotently |
| Public metrics | `app/metrics/`, `lib/metrics.ts` | Live coverage and revenue figures, real and paper never summed |
| Social bot | `bot/social/` | Farcaster and X connectors with a spend-cap ledger |
| Tests | `scripts/test-*.ts` | 34 scripts covering the above |

Prior development ran 2026-08-30 → 2026-09-02 across 22 commits. The `GATES.*.md` files are the
acceptance ledgers from those rounds and are kept in the repo as timestamped evidence of what was
built when — they are not decoration, they are the audit trail this disclosure rests on.

## What is being built during the event

Tracked below as it lands. Every entry links to commits made after 2026-09-04.

<!-- Append one row per shipped feature. Keep it honest: if a thing was started before, say so. -->

| Date | What | Commits | Track it targets |
| --- | --- | --- | --- |
| — | *(nothing yet — the event began 2026-09-04)* | — | — |

## Tracks entered

To be confirmed at submission. Candidates, in priority order:

1. **Bazantic** — register the x402-priced API so other agents can discover and pay for it
2. **Hedera** — stand up the x402 service on Hedera via the Blocky402 facilitator
3. **The Graph (Continuity)** — use live Graph data as a source the agent can query and pay for

## Honesty notes

- The x402 endpoint currently settles on `base-sepolia`, a testnet. It cannot take real money as
  shipped. Any claim about revenue in this repo refers to plumbing that exists, not income received.
- Trading runs in paper mode on the deployed site (`HL_MODE=paper`). Perp orders are signed for real
  only when an operator sets a key.
- ETHGlobal's own rules note that submissions leaning on pre-existing work historically score lower.
  That is the trade we are making knowingly: the point of entering is the new work listed above.
