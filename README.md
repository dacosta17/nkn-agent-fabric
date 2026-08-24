# NKN Verifiable Agent Network

A research-grade distributed-agent POC built on the official NKN JavaScript SDK. The project is not a generic agent marketplace: its core primitive is **verifiable independent execution**.

## Core idea

```text
Task
  ↓
Discover capable agents
  ↓
NKN execution fabric
  ↓
Independent evidence / attestations
  ↓
Deterministic domain validator
  ↓
Quorum + Byzantine rejection
  ↓
Verified result
  ↓
Reputation / eventual payment
```

NKN already has public AI-agent messaging examples, so the differentiator here is not A2A messaging itself. The project asks whether NKN can carry a permissionless, cross-operator **verification layer for agent work**, where an answer/action is accepted only when it satisfies an explicit domain policy and evidence requirements.

## Five domain families

### 1. Intelligence
Multiple agents independently answer a research question and attach source evidence. The result is accepted only when independent evidence reaches quorum.

### 2. Security
Independent agents assess the same target. A critical finding blocks approval; severity and finding provenance remain part of the signed evidence.

### 3. Infrastructure
Agents from separate observation points assess service health. The result requires an availability quorum and reports median latency instead of trusting one probe.

### 4. DeFi
Independent risk agents evaluate a proposed action. The deterministic policy rejects any provider denial or a median risk score above the configured threshold. No wallet execution is performed by the demo.

### 5. Automation
Independent policy agents approve or reject an action against an exact policy version. A mismatched policy version invalidates the result, preventing stale-policy execution.

All five use the same task/attestation/provenance primitives; only the deterministic domain validator changes.

## Architecture

```text
                           NKN overlay
                                │
            ┌───────────────────┼───────────────────┐
            │                   │                   │
       Agent operator A    Agent operator B    Agent operator C
            │                   │                   │
        capability          capability          capability
        + quote             + quote             + quote
            │                   │                   │
            └──────────── signed execution ────────┘
                                │
                         Verification layer
                                │
             ┌──────────────────┼──────────────────┐
             │                  │                  │
        Intelligence         Security          Infra/DeFi/Automation
             │                  │                  │
             └──────────────────┴──────────────────┘
                                │
                         verified result
```

## Verification layers

- signed capability manifests bound to NKN addresses
- signed task quotes
- signed execution attestations
- task/result SHA-256 provenance
- freshness and replay protection
- deterministic domain validators
- independent-provider quorum
- Byzantine/outlier rejection
- reputation updates
- NKN packet/session transport tests
- fault injection and negative assertions

## What this is not

It is not a trading bot, price-pump mechanism, fake-traction system, or autonomous wallet executor. The DeFi layer currently stops at **risk verification** and deliberately does not execute transactions.

## Roadmap

**Intelligence → Security → Infrastructure → DeFi → Automation** is implemented as a reusable verification stack. The next research steps are permissionless discovery, portable signed reputation, economic settlement/escrow, multi-region benchmarks, collusion/Sybil testing, and real-world operator deployments.
