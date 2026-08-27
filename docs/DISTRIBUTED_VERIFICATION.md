# Distributed Verification Model

## Objective

The coordinator is an orchestration convenience, not a trust anchor. A verification round must remain independently verifiable if the coordinator is unavailable or malicious.

## Round model

Each round has a deterministic `roundId`, `taskDigest`, participant set, quorum policy, and evidence deadline. Participants produce signed observations and signed verification votes. A result is valid only when an independent verifier can reconstruct the round from the evidence set and derive the same quorum decision.

## Trust boundaries

- **NKN** provides decentralized transport and authenticated client addressing; it does not decide application truth.
- **Agent identity** authenticates the signer of an observation or vote.
- **Independence policy** determines whether observations are sufficiently independent for the configured quorum.
- **Quorum policy** determines whether the evidence set is sufficient; it is not a claim of Byzantine consensus safety beyond the documented fault model.
- **Coordinator** may route tasks and aggregate evidence, but its output is never authoritative.

## Required properties

1. A coordinator failure must not invalidate already collected evidence.
2. A coordinator cannot manufacture a valid quorum without the required participant signatures.
3. A verifier that receives the same signed evidence must derive the same decision.
4. Duplicate, stale, malformed, identity-mismatched, and out-of-policy votes are rejected.
5. The protocol must fail closed when quorum cannot be established.

## What this does not claim

This model is application-level verifiable quorum, not a replacement for NKN's network consensus and not a full BFT protocol. Byzantine safety is bounded by the configured independence assumptions and quorum policy.
