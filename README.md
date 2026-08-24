# NKN Agent Fabric

A research-grade distributed-agent POC built on the official NKN JavaScript SDK.

## Why this exists

Public NKN examples already demonstrate secure peer-to-peer messaging, file transfer, remote connectivity, and AI-agent messaging through the official Eliza plugin. This project deliberately goes one layer above transport: it tests whether independent agents can discover capabilities, negotiate tasks, produce cryptographically verifiable execution attestations, reach a quorum on external observations, reject Byzantine providers, and adapt reputation after conflicts.

## Architecture

```text
                         NKN overlay
                              |
            +-----------------+------------------+
            |                 |                  |
       Agent A             Agent B            Agent C
      provider             provider          provider
            \                 |                  /
             \                |                 /
              +-------- Attested task --------+
                              |
                         Coordinator
                              |
                 +------------+-------------+
                 |                          |
           quorum engine             reputation book
                 |                          |
                 +------------+-------------+
                              |
                        verified result
```

### Core protocol

1. **Capability discovery** — each agent publishes a signed capability manifest bound to its NKN address.
2. **Task negotiation** — agents return signed quotes describing supported capability, price and expected latency.
3. **Attested execution** — results are bound to request ID, task digest, result digest, source and signer identity.
4. **Independent verification** — the coordinator verifies signatures and evidence before accepting a result.
5. **Byzantine resistance** — multiple independent providers are compared and outliers are rejected.
6. **Adaptive trust** — successful executions increase reputation; contradictory attestations create conflicts and lower trust.
7. **Transport resilience** — the same protocol is exercised over NKN packet mode and session mode, with fault injection and latency baselines.

## What is novel here

The important claim is **not** "AI agents can message over NKN". NKN already demonstrates that and its official Eliza integration makes that use case public. The research question here is:

> Can NKN act as the transport substrate for a permissionless, cross-operator agent execution market where identity, task negotiation, provenance, verification and fault tolerance are first-class protocol primitives?

The current live test uses NKN to connect independent workers that query different public market-data providers. A Byzantine worker deliberately returns a manipulated price. The system must still produce a valid quorum, prove which agents produced the evidence, survive worker failures, and finally refuse to form a quorum when too few independent sources remain.

## Verification layers

- Node 22/24 CI
- deterministic unit tests
- signed capability/quote/attestation tests
- live NKN packet-mode test
- live NKN session-mode test
- 3 honest providers + Byzantine provider
- provider outage / worker failure injection
- freshness and evidence-digest checks
- p50/p95/p99 NKN RTT benchmark
- localhost HTTP centralized baseline
- reproducible integration reports uploaded as GitHub artifacts

## Important limitation

The agent-trust signatures are an application-layer attestation system. NKN transport itself already authenticates/encrypts traffic; this project adds explicit, portable evidence semantics on top. Actual economic settlement using NKN tokens is intentionally separated from the current benchmark and would be a later phase after the trust protocol is validated.
