# Protocol overview

## Envelope

Every application message carries a request ID, sender, recipient, task payload, and message kind. The envelope is validated before domain processing.

## Capability

An agent capability manifest binds a capability version to the agent's NKN address and signing identity. A verifier must check the binding before accepting quotes or attestations.

## Quote

A quote describes the capability offered, expected latency, and optional price metadata. Quotes are advisory; they do not create economic obligations in the current POC.

## Attestation

An execution attestation binds:

- request ID;
- agent identity;
- task digest;
- result digest;
- source/provider identity;
- capture time.

This creates portable evidence that can be independently verified without trusting the transport implementation.

## Verification

The verifier first validates signatures and freshness, then applies a domain-specific deterministic policy. The policy may require:

- minimum provider count;
- unique operators and providers;
- evidence/source diversity;
- quorum;
- critical-finding veto;
- risk thresholds;
- exact policy-version matching.

## Future economic layer

A later protocol version may bind a verified task receipt to a payment or escrow receipt. Economic settlement is intentionally outside the safety proof until identity, reputation, and collusion assumptions are stronger.
