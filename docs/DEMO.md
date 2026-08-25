# NKN Verifiable Agent Network Demo

This is the public-facing end-to-end showcase for the project.

## Run

```bash
npm ci
npm run demo:nkn
```

Optional controls:

```bash
NKN_DEMO_ROUNDS=6 NKN_DEMO_RTT_SAMPLES=20 npm run demo:nkn
```

The demo uses the live NKN network and the existing adversarial consensus integration. It starts a coordinator and four NKN workers: three independent market observers and one deterministic Byzantine observer.

## What the demo proves

1. Agents can discover and communicate over NKN.
2. Packet and session transport both work.
3. Agents return signed/verifiable evidence.
4. Three independent observations can form a quorum.
5. A Byzantine outlier is rejected.
6. Quorum survives loss of the adversarial worker.
7. Quorum survives loss of one honest source while two remain.
8. The verifier refuses to decide when only one valid source remains.
9. NKN RTT is measured alongside a local HTTP lower-bound baseline.

## What it does not claim

The demo does not claim that NKN is the lowest-latency transport, that an operator registry alone provides permissionless Sybil resistance, or that the market-data example is a production oracle.

The value proposition being tested is architectural: decentralized peer communication and addressability can carry a verifiable multi-agent protocol without requiring a centralized message broker.

## Demo flow

```text
                    NKN NETWORK
                         │
       ┌─────────────────┼─────────────────┐
       ▼                 ▼                 ▼
   CoinGecko         CoinPaprika          Gate
    Agent A            Agent B           Agent C
       │                 │                 │
       └─────────────────┼─────────────────┘
                         │
                    Coordinator
                         ▲
                         │
                  Byzantine Agent
                         │
                    outlier value
                         │
                         ▼
                verified quorum result
```

The terminal output intentionally shows both successful verification and the cases where the protocol refuses to produce a result. That distinction is part of the security demonstration.

## Reproducibility

The underlying integration emits a JSON report containing the NKN addresses, consensus rounds, resilience outcomes, and latency percentiles. Keep the raw report when using the demo in a technical presentation; do not quote a single latency number without its run context.
