# NKN Verifiable Agent Network

Research-grade open-source protocol POC for **verifiable independent agent execution over NKN**.

[![CI](https://github.com/dacosta17/nkn-agent-fabric/actions/workflows/ci.yml/badge.svg)](https://github.com/dacosta17/nkn-agent-fabric/actions/workflows/ci.yml)

> **Thesis:** NKN is the transport/addressability layer; this project adds an application-level verification layer so independent agents can produce signed evidence, satisfy deterministic domain policies, reach quorum, and reject Byzantine or low-quality providers.

This is deliberately **not** an agent marketplace, trading bot, price-pump system, or autonomous wallet executor.

## 60-second demo

The fastest way to see the thesis is the live NKN agent-network demo:

```bash
npm ci
npm run demo:nkn
```

It starts a coordinator and four live NKN workers: three independent market observers plus a deterministic Byzantine observer. The demo shows packet/session connectivity, signed evidence, quorum formation, Byzantine rejection, resilience after worker loss, explicit quorum failure when independence becomes insufficient, and NKN latency alongside a local HTTP lower-bound baseline.

See [`docs/DEMO.md`](docs/DEMO.md) for the exact claims and security boundaries.

## Why this project exists

NKN already has public examples for P2P messaging, remote connectivity, file transfer, and AI-agent messaging. The interesting question here is one layer above transport:

> Can independent agents operated by different parties execute the same task, return portable evidence, and produce a verifiable result without trusting a single agent or upstream source?

The current implementation tests that thesis over the official `nkn-sdk` MultiClient transport.

## Primary proof-of-value: verifiable agent consensus

The strongest project demonstration is a live NKN consensus flow:

```text
                 Task
                   │
          ┌────────┼────────┐
          ▼        ▼        ▼
       Agent A  Agent B  Agent C
          │        │        │
          └──── NKN overlay ────┘
                   │
          signed observations
                   │
        independence policy
                   │
       quorum / Byzantine checks
                   │
             verified result
```

The underlying integration can also be run directly with `npm run integration:agent-consensus`.

**Security boundary:** distinct operator IDs are policy inputs, not permissionless Sybil resistance. NKN provides decentralized addressability and peer communication; it does not by itself prove that two operators are controlled by different real-world entities. Production deployments need an operator registry, attestations, stake/economic bonding, or an equivalent mechanism.

## Operator identity layer

The next protocol layer is a signed operator registry. `src/lib/operator-registry.js` defines versioned Ed25519-signed operator records that bind an operator identity to an application public key and one or more NKN addresses. Verifiers can check membership before counting an agent toward an independence quorum.

This registry is an **identity primitive, not permissionless Sybil resistance**. It proves membership in a registry snapshot; it does not prove that two registered identities are controlled by independent real-world entities. See [`docs/OPERATOR_REGISTRY.md`](docs/OPERATOR_REGISTRY.md).

## Reference protocol v1

The project now freezes a transport-agnostic protocol core alongside the NKN adapters:

- canonical JSON and SHA-256 digest rules;
- versioned envelopes;
- cross-language interoperability vectors;
- a Go reference implementation with no transport dependency;
- JavaScript and Go implementations that must produce identical canonical bytes and digests.

See [`protocol/README.md`](protocol/README.md), [`docs/PROTOCOL.md`](docs/PROTOCOL.md), and [`vectors/protocol-v1-canonical.json`](vectors/protocol-v1-canonical.json).

NKN transport remains an adapter layer. The official NKN Go SDK provides MultiClient and session primitives suitable for a Go transport implementation, while the protocol package stays language- and transport-agnostic.

## Five task domains

**Intelligence** — independent research agents provide source-backed observations; weak or non-quorum evidence is rejected.

**Security** — independent assessments are combined with a critical-finding veto and signed finding provenance.

**Infrastructure** — independent observers report availability and latency; acceptance requires a health quorum.

**DeFi** — independent risk agents evaluate a proposed action before execution. The current POC deliberately stops at risk verification and does not sign or broadcast transactions.

**Automation** — independent policy agents approve an action against an exact policy version, preventing stale-policy execution.

All five domains reuse the same capability, quote, attestation, provenance, freshness, and deterministic-verification primitives.

## What is actually tested

- NKN packet-mode request/reply;
- NKN session-mode smoke path;
- signed capability manifests bound to NKN addresses;
- signed task quotes and execution attestations;
- SHA-256 task/result evidence digests;
- freshness and bounded replay protection;
- independent-provider and operator-diversity checks;
- explicit same-operator/Sybil-policy failure cases;
- signed operator registry records and membership checks;
- Byzantine/outlier rejection;
- failure injection and explicit quorum-failure assertions;
- p50/p95/p99 NKN RTT measurement;
- centralized localhost HTTP lower-bound baseline;
- deterministic domain matrix with positive and negative cases;
- shared JavaScript/Go canonicalization vectors.

## Quick start

Requirements: Node.js 22+ and Go 1.22+.

```bash
npm install
npm run check
npm test
npm run test:domains
go test ./...
```

Run the live NKN integration from a network-enabled environment:

```bash
npm run integration:nkn
npm run integration:agent-consensus
```
