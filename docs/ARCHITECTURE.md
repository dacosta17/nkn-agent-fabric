# Architecture

The experiment separates five trust domains:

1. **Coordinator** — creates a task and gathers signed-by-transport observations.
2. **NKN transport** — carries the request/reply between agents using the official NKN SDK.
3. **Independent workers** — query different public market APIs.
4. **Deterministic auditor** — validates structure, evidence digests, freshness, and quorum.
5. **Optional model layer** — may summarize or plan, but cannot override deterministic validation.

The experiment is intentionally not described as Byzantine fault tolerant. A future phase must test node collusion, stale data, endpoint poisoning, replay, partial partition, and Sybil-style duplication before making stronger decentralization claims.
