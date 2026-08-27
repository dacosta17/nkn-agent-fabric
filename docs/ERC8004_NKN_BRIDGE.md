# ERC-8004 ↔ NKN identity bridge

This module makes the existing NKN operator identity portable into an ERC-8004 agent registration file. It intentionally does **not** implement or duplicate the ERC-8004 Identity, Reputation, or Validation registries.

## Why this is useful

ERC-8004 provides a portable on-chain agent identity and standardized registration file. NKN provides decentralized peer addressing and communication. The bridge binds the two at the application layer:

```text
ERC-8004 agentId + agentRegistry
              │
              │ registration file
              ▼
       NKN service endpoint
              │
              ▼
   signed NKN operator record
```

A verifier can therefore require both:

1. the registration file to claim the ERC-8004 identity; and
2. the advertised NKN address to be bound to a signed operator record.

This is stronger than merely copying an NKN address into metadata because the NKN side remains independently cryptographically verifiable.

## Scope and non-goals

- No blockchain RPC dependency.
- No automatic transaction submission.
- No duplicate ERC-8004 registry implementation.
- No claim that an ERC-8004 identity proves operator independence or Sybil resistance.
- No claim that an NKN address is an on-chain wallet identity.

A production integration should obtain the authoritative `agentURI` and registry state from the relevant ERC-8004 chain/indexer before calling `verifyErc8004NknBinding`.

## NKN service endpoint

The bridge advertises NKN addresses as `nkn:<address>` service endpoints. ERC-8004 deliberately allows extensible service endpoint types; consumers that understand NKN can interpret this endpoint and connect using the NKN SDK.

The bridge also keeps the signed operator record as the source of truth for NKN address binding. This avoids treating an arbitrary registration-file string as proof of control.

## Trust model

ERC-8004 and this bridge solve different problems:

- ERC-8004: portable agent identity/discovery and standardized reputation/validation hooks.
- NKN: decentralized communication/addressability.
- Operator registry: cryptographic binding of an application operator to NKN addresses.
- Agent Fabric quorum: protocol-level evidence aggregation and Byzantine handling.

Sybil resistance still requires an independent admission, reputation, economic, or validation mechanism.
