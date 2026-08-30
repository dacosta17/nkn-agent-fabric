# Crypto Earning Agent

## Purpose

Turn `nkn-agent-fabric` into an autonomous opportunity-hunting system whose objective is to identify legitimate, measurable ways for software agents to earn crypto, rank them by expected value, and eventually execute bounded tasks.

The first implementation is intentionally read-only. It scans public opportunities and does not sign transactions, move funds, or test live systems.

## Business model

The system optimizes:

`expected payout × execution probability - external spend - infrastructure cost - failure reserve`

The target is **positive expected value per unit of autonomous execution time**, not the largest advertised bounty.

## Opportunity classes

### A. Agent-native paid work

Primary source: Agent Bounties.

Agent Bounties explicitly supports the flow `inspect -> prepare wallet -> claim -> solve -> submit -> verify -> confirm payment`, with canonical settlement on Base USDC. Only a confirmed `BountySettled` event is treated as payment evidence.

### B. GitHub task bounties

Public GitHub issues containing explicit reward signals are discovered and ranked. These are candidates for automated repository inspection, test execution, patch generation and PR creation.

### C. Security research

Immunefi programs are treated as a separate high-value class. Automation may inspect public program terms and perform local/static analysis, but the system must obey each program's scope and prohibited-activity rules. No live exploitation or abusive traffic generation is allowed.

## Execution ladder

1. **Discover** — collect public opportunities.
2. **Normalize** — extract payout, network, funding state, eligibility, deadlines and evidence requirements.
3. **Score** — estimate expected value and execution cost.
4. **Prepare** — produce a machine-readable work packet.
5. **Execute** — only for sources whose workflow supports bounded agent execution.
6. **Verify** — require objective evidence before claiming a reward.
7. **Settle** — treat only canonical on-chain settlement as payment.
8. **Reinvest** — optionally allocate a capped portion of earnings to the next opportunity.

## Current implementation

`src/opportunities/earning-scan.js` is the first discovery engine. It currently scans:

- Agent Bounties claimable feed on Base mainnet.
- Public GitHub issues with a bounty label and explicit reward amounts.

The scanner emits `earning-opportunities.json` and is scheduled every six hours by `.github/workflows/earning-scan.yml`.

## What this means economically

The system is not a passive-income promise. It is an **autonomous deal-flow and execution engine**. The core advantage is that the agent can evaluate a much larger opportunity set than a human and reserve execution for opportunities with measurable positive expected value.

## Next execution phase

The next engineering step is to add a bounded executor for Agent Bounties and GitHub code tasks, with:

- a dedicated low-balance wallet;
- strict spending caps;
- allowlisted domains/repositories;
- deterministic acceptance checks;
- automatic evidence collection;
- settlement verification;
- a per-opportunity kill switch;
- no secret material in source control.

Revolut support must be checked per token/network before any withdrawal. Revolut Greece warns that unsupported networks can result in lost funds and currently lists specific supported deposit currencies/networks in-app.
