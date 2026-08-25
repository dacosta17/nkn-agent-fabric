# Sybil & Collusion Simulation

This experiment measures the failure modes of quorum when identity count is not the same thing as operator count.

## Threat model

- **Honest operator:** returns the protocol's expected observation.
- **Malicious operator:** returns an adversarial observation.
- **Sybil factor:** one malicious operator controls multiple registered identities.
- **Collusion:** malicious identities coordinate on the same false observation.
- **Quorum:** minimum observations required for acceptance.

## What this proves

The simulator can identify parameter regions where a naive identity-count quorum is unsafe or unavailable. It also makes the distinction between `maliciousIdentities` and `distinctMaliciousOperators` explicit.

It does **not** prove real-world operator independence, and it does not claim that NKN provides Sybil resistance. NKN is the decentralized communication/addressability layer; admission, economic security, and governance are separate protocol concerns.

## Why this matters for NKN

A decentralized agent protocol should not hide centralized assumptions behind an NKN transport. The attack matrix gives us a reproducible security baseline before adding reputation, staking, or dispute mechanisms.

## Next step

Use these deterministic thresholds to design an economic-security layer, then run the same scenarios through real NKN-connected workers and compare the resulting resilience and operational cost against a centralized broker architecture.
