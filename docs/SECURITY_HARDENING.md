# Security hardening: identity, diversity, and independent verification

This change addresses the three highest-risk protocol weaknesses identified in the security review.

## 1. NKN/application identity binding

An application signing key is not accepted as an identity claim by itself. The manifest now carries an `nkn-identity-binding.v1` proof containing the NKN address and application public key. Verification additionally requires the authenticated NKN transport source to equal the address in the proof. This means a key cannot be presented as belonging to an NKN address unless the responder is actually reachable as that address during the authenticated exchange.

This is a **transport-bound proof of control**, not a claim that the two key pairs are mathematically identical. A future protocol version may use the NKN signing key directly if the SDK exposes a stable signing API suitable for the wire protocol.

## 2. Source/operator diversity

Every observation now carries:

- `operatorId` — the accountable operator;
- `providerId` — the upstream provider;
- `sourceGroup` — a correlation class for providers that may share the same underlying data source.

A quorum requires distinct operators, providers, and source groups by default. Multiple agents querying the same provider therefore cannot masquerade as independent evidence.

Source-group independence is still an explicit attestation/registration claim; the protocol does not pretend that statistical independence of real-world data sources can be proven cryptographically.

## 3. Coordinator trust reduction

The coordinator must pass an explicit `expectedPeers` participant set into deterministic verification. The verifier rejects missing, duplicate, or unexpected peers. The resulting verification bundle has a deterministic digest and can be checked by another verifier without trusting the coordinator's calculation.

This prevents a coordinator from changing the participant set while preserving the same verification result. It does **not yet provide censorship resistance**: a malicious coordinator can still refuse to initiate a task. The next step is to bind `expectedPeers` to a requester-signed task receipt and allow independent verifiers to collect evidence directly.

## Acceptance criteria

- A valid manifest verifies only when its NKN transport source matches the bound address.
- Replaying a binding proof under another NKN source fails.
- A quorum using two agents from the same provider is rejected.
- A quorum using the same source group twice is rejected.
- A coordinator result with a missing required peer is rejected.
- A second verifier can validate the result digest and diversity constraints without rerunning the coordinator.
- Existing signature, freshness, tamper, and protocol-vector tests remain green.
