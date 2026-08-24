# NKN Verifiable Agent Network

Research-grade open-source protocol POC for **verifiable independent agent execution over NKN**.

[![CI](https://github.com/dacosta17/nkn-agent-fabric/actions/workflows/ci.yml/badge.svg)](https://github.com/dacosta17/nkn-agent-fabric/actions/workflows/ci.yml)

> **Thesis:** NKN is the transport/addressability layer; this project adds an application-level verification layer so independent agents can produce signed evidence, satisfy deterministic domain policies, reach quorum, and reject Byzantine or low-quality providers.

This is deliberately **not** an agent marketplace, trading bot, price-pump system, or autonomous wallet executor.

## Why this project exists

NKN already has public examples for P2P messaging, remote connectivity, file transfer, and AI-agent messaging. The interesting question here is one layer above transport:

> Can independent agents operated by different parties execute the same task, return portable evidence, and produce a verifiable result without trusting a single agent or upstream source?

The current implementation tests that thesis over the official `nkn-sdk` MultiClient transport.

## Five task domains

**Intelligence** — independent research agents provide source-backed observations; weak or non-quorum evidence is rejected.

**Security** — independent assessments are combined with a critical-finding veto and signed finding provenance.

**Infrastructure** — independent observers report availability and latency; acceptance requires a health quorum.

**DeFi** — independent risk agents evaluate a proposed action before execution. The current POC deliberately stops at risk verification and does not sign or broadcast transactions.

**Automation** — independent policy agents approve an action against an exact policy version, preventing stale-policy execution.

All five domains reuse the same capability, quote, attestation, provenance, freshness, and deterministic-verification primitives.

## Architecture

```text
                 Task
                   │
             capability discovery
                   │
        ┌──────────┼───────────┐
        ▼          ▼           ▼
     Agent A    Agent B     Agent C ...
        │          │           │
        └────── NKN overlay ───┘
                   │
          signed evidence
                   │
       independent providers
         + operator diversity
                   │
       deterministic validator
                   │
      quorum / Byzantine rejection
                   │
           verified result
                   │
       reputation / future settlement
```

## What is actually tested

- NKN packet-mode request/reply;
- NKN session-mode smoke path;
- signed capability manifests bound to NKN addresses;
- signed task quotes and execution attestations;
- SHA-256 task/result evidence digests;
- freshness and bounded replay protection;
- independent-provider and operator-diversity checks;
- Byzantine/outlier rejection;
- failure injection and explicit quorum-failure assertions;
- p50/p95/p99 NKN RTT measurement;
- centralized localhost HTTP lower-bound baseline;
- deterministic domain matrix with positive and negative cases.

## Quick start

Requirements: Node.js 22+ (Node 24 is used by CI).

```bash
npm install
npm run check
npm test
npm run test:domains
```

Run the live NKN integration from a network-enabled environment:

```bash
npm run integration:nkn
```

Run the attested market-data example:

```bash
npm run integration:market
```

The live tests use public endpoints. Provider rate limits are treated as provider conditions, not as evidence that NKN itself failed.

## Evidence and security model

A signature proves **who made a claim**. It does not prove the claim is true.

The application therefore separates:

1. NKN transport authenticity/encryption;
2. application identity signatures;
3. external evidence provenance;
4. freshness and replay checks;
5. deterministic domain policy;
6. quorum and diversity requirements.

See [`docs/PROTOCOL.md`](docs/PROTOCOL.md) and [`docs/THREAT_MODEL.md`](docs/THREAT_MODEL.md).

## Public benchmark standard

The current localhost comparison is intentionally only a lower bound. A serious performance paper should compare NKN against a centralized multi-region transport under identical topology, payloads, concurrency, retry policy, and regions.

See [`docs/BENCHMARKS.md`](docs/BENCHMARKS.md).

## Current limitations

This repository does **not** claim to solve permissionless identity, Sybil resistance, collusion, censorship resistance, economic finality, or production-grade autonomous DeFi execution. Reputation is not yet a security primitive, and the coordinator remains centralized in the current POC.

## Roadmap

1. permissionless capability discovery;
2. portable signed reputation receipts;
3. multi-region WAN benchmarks;
4. collusion/Sybil experiments and source-correlation analysis;
5. economic security with escrow/stake/dispute experiments;
6. optional NKN-denominated settlement after the verification layer is independently validated.

See [`docs/ROADMAP.md`](docs/ROADMAP.md).

## License

Apache-2.0. See [`LICENSE`](LICENSE).

## Disclaimer

This is experimental research software. Do not use it with production private keys, unattended financial authority, or safety-critical infrastructure without an independent review.
