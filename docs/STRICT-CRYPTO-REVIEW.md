# Strict Crypto / Distributed-Systems Review

## Review objective

Reject the project if it is only a message-passing demo or a thin wrapper around a centralized API.

## Required properties

- Uses the official NKN SDK as the transport layer.
- Separates transport, protocol, orchestration, validation, and model-assisted reasoning.
- Never lets an LLM act as the trust boundary.
- Uses independent data providers where the experiment claims decentralization or quorum.
- Carries timestamps, request IDs, evidence digests, and protocol versions.
- Enforces request expiry, bounded deduplication, payload limits, and deterministic validation.
- Includes failure injection and a centralized baseline.
- Reports p50/p95/p99 latency, success rate, retry behavior, and disagreement rate.
- Does not claim security or decentralization properties that have not been measured.

## Known limitations

The first benchmark is a research prototype. It does not yet establish Byzantine fault tolerance, Sybil resistance, censorship resistance, or economic security. Those require larger-scale experiments and adversarial topology testing.
