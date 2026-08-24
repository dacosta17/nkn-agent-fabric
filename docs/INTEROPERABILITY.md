# Cross-language interoperability

Protocol v1 separates transport from wire semantics.

## Current implementations

- JavaScript canonicalization and application runtime;
- Go canonicalization package under `protocol/`;
- shared normative vector at `vectors/protocol-v1-canonical.json`.

## Acceptance test

An implementation is interoperable only when it reproduces the same canonical UTF-8 bytes and SHA-256 digest for every normative vector.

```text
same object
   ↓
canonical bytes
   ├── JavaScript
   └── Go
   ↓
identical bytes
   ↓
identical SHA-256 digest
```

## Transport adapter boundary

The protocol package has no NKN dependency. NKN is an adapter layer. The official NKN Go SDK exposes `NewMultiClientV2`, packet messaging, and reliable sessions; those APIs will be used by the next live cross-language transport milestone.

## Next interoperability milestone

1. Go NKN transport adapter;
2. JS ↔ Go packet request/reply over NKN;
3. JS ↔ Go session round trip;
4. cross-language signed attestation verification;
5. negative tests for version, digest, freshness and operator/provider policy mismatches.
