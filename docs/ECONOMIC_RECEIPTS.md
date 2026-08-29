# Economic execution receipts

This module binds an agent payment reference to the exact execution that produced the paid result.

The receipt is deliberately **settlement-agnostic**. It does not claim that a payment occurred merely because a string says so. A production adapter must verify the external settlement/payment reference before issuing the signed receipt.

## Why this matters

Agent economies are moving from identity and discovery toward machine-to-machine payments. This project can connect that economic event to NKN transport and independently verifiable execution:

```text
payer
  │ payment / settlement
  ▼
settlement adapter ── verifies payment reference
  │
  ▼
signed economic receipt
  │
  ├── task digest
  ├── result digest
  ├── NKN address
  ├── payment reference
  └── amount / asset
  │
  ▼
Agent Fabric verifier
```

The important property is **economic-to-execution binding**: a receipt cannot be replayed for a different task, result, payment reference, or NKN endpoint without invalidating verification.

## Security properties

- Ed25519 signatures provide authenticity of the receipt issuer.
- SHA-256 over canonical JSON provides a portable receipt digest.
- Task/result digests bind payment to the exact execution evidence.
- The NKN address binds the economic event to the transport identity used for delivery.
- A payment reference binds the receipt to an external settlement record.
- `issuedAt` plus bounded freshness prevents indefinite replay.
- `nonce` gives adapters a deterministic place to enforce uniqueness.

## Non-goals

This module does **not** implement x402, a blockchain payment verifier, a wallet, custody, or settlement finality. Those belong in adapters. A signed receipt from an untrusted issuer is not evidence that funds actually moved.

The intended next integration is an x402 settlement adapter that verifies an HTTP 402 payment and then emits this receipt, allowing the same paid agent task to be transported over NKN and verified by independent agents.
