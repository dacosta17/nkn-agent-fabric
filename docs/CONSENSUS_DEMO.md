# Live NKN Agent Consensus Demo

## Goal

This demo is the project's primary proof-of-value scenario for NKN:

> independent agents exchange observations over NKN, return signed evidence, and a deterministic verifier accepts the result only when the required independence policy is satisfied.

The demo uses two live workers:

- CoinGecko market observation
- Binance market observation

Each worker has a distinct operator identifier, provider, and source group. The coordinator communicates with the workers through the NKN MultiClient transport and then applies the same verification policy used by the test suite.

## Run

```bash
npm install
npm run check
npm test
npm run integration:agent-consensus
```

The command requires a network-enabled environment because workers call public market-data endpoints and all agent-to-agent traffic uses NKN.

## What the demo proves

1. Agents receive a task over NKN without a centralized HTTP broker.
2. Each agent returns an observation and evidence metadata.
3. Evidence is bound to a deterministic digest.
4. The verifier checks operator, provider, and source-group diversity.
5. The final verification result is itself deterministically hashed.
6. A provider disagreement or diversity failure causes quorum failure rather than silently selecting one source.

## What it does not prove

Distinct `operatorId` values are a policy input, not permissionless Sybil resistance. Running two workers on the same machine does not establish that two independent organizations operate them.

A production-grade permissionless network needs one or more of:

- externally verifiable operator attestations;
- a registry with admission controls;
- stake or economic bonding;
- dispute/slashing rules;
- operator-key rotation and revocation;
- anti-collusion/source-correlation analysis.

The code intentionally makes this boundary explicit instead of claiming that NKN transport alone solves Sybil resistance.

## Why NKN matters

The value proposition is not simply that an agent can send JSON over NKN. The experiment is that NKN provides decentralized agent addressability and encrypted peer communication underneath a verifiable execution protocol. The protocol layer remains transport-agnostic, so the same consensus logic can be benchmarked against a centralized transport baseline.

The strongest follow-up experiment is a WAN benchmark with identical payloads, concurrency, retries, regions, and agent workloads comparing NKN with a centralized multi-region broker.
