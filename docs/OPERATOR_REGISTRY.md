# Operator Registry v1

The operator registry is the next identity layer above NKN transport.

## Purpose

An operator record cryptographically binds an operator identifier to an application public key and one or more NKN addresses. Verifiers can therefore reject an agent whose NKN address is not registered for the claimed operator.

This protects the protocol from accidental identity substitution and makes operator membership auditable.

## Security boundary

This is **not permissionless Sybil resistance**.

A registry can establish that two records are different registered identities. It cannot establish that two identities are controlled by two independent real-world operators unless admission is backed by an external attestation, governance process, economic bond, or equivalent trust anchor.

NKN provides decentralized addressability and peer communication. The registry is an application-layer identity primitive.

## Record lifecycle

Records are signed with Ed25519 and include:

- `operatorId`
- operator application public key
- bound NKN addresses
- capabilities
- creation and expiry timestamps
- nonce
- record digest
- signature

Short-lived records are preferred. Rotation should create a new record and preserve the old record for audit/revocation history rather than silently mutating identity.

## Verification requirements

A verifier should check:

1. record type/version;
2. validity window;
3. signature and digest;
4. operator ID uniqueness within the registry snapshot;
5. claimed NKN address membership;
6. registry snapshot integrity.

The registry must be treated as a versioned security input to quorum decisions. A future production implementation should sign the registry snapshot itself and define revocation semantics.

## Next security layers

- signed registry snapshots and key rotation;
- revocation/status lists;
- portable reputation receipts;
- external operator attestations;
- Sybil/collusion experiments;
- economic bonding and dispute/slashing mechanisms.
