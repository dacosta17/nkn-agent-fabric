# Threat Model

## Security objective

The protocol should only accept a result when the evidence is sufficiently fresh, cryptographically attributable, and diverse enough to satisfy the task's deterministic domain policy.

## Trust boundaries

1. **NKN transport** — provides authenticated/encrypted delivery between NKN addresses. It does not establish truth.
2. **Agent identity** — signs manifests, quotes, and attestations. Key possession is not proof of operator independence.
3. **Evidence source** — external APIs, RPC endpoints, scanners, or other observations may be wrong or correlated.
4. **Coordinator** — current POC orchestration is centralized; a compromised coordinator can suppress or reorder observations, but cannot forge a valid agent signature without the agent key.
5. **Domain validator** — deterministic policy decides whether collected evidence is acceptable.

## Adversaries

### Byzantine agent
Can return deliberately false observations, stale evidence, invalid digests, or conflicting claims.

Mitigation: signed attestations, freshness checks, evidence digests, independent-provider quorum, explicit outlier rejection.

### Sybil operator
Can create multiple agent identities.

Mitigation today: operator/provider diversity is an explicit quorum input. Limitation: identity metadata is not yet backed by economic stake or decentralized reputation.

### Correlated source attacker
Controls or influences multiple upstream providers or feeds.

Mitigation today: provider and operator diversity. Limitation: the project cannot prove statistical independence of real-world sources.

### Replay attacker
Attempts to reuse a prior valid message or attestation.

Mitigation: request IDs, TTL/freshness, task/result digests, bounded replay caches.

### Stale-data attacker
Returns an old but validly signed observation.

Mitigation: evidence timestamps and maximum observation age.

### Coordinator compromise
Attempts to select a malicious result or omit honest results.

Current mitigation: application evidence is independently attributable and the deterministic validator can recompute decisions. Production mitigation requires multiple verifiers or replicated coordination.

## Non-goals

The current POC does not claim to solve permissionless identity, Sybil resistance, collusion, censorship resistance, economic finality, or production-grade autonomous DeFi execution.

## Security invariant

Never infer truth from a signature alone. A signature proves authorship; the domain policy determines acceptability of the claim.
