# NKN Verifiable Agent Protocol v1

This document is the language-neutral specification boundary for the application protocol. Transport adapters MUST NOT change the canonical wire semantics.

## 1. Versioning

`v = 1` identifies this specification. Implementations MUST reject unsupported versions before domain processing.

## 2. Canonical JSON

Protocol objects that are signed, hashed, or referenced by a digest MUST use the v1 canonical form:

- UTF-8 encoded JSON;
- object keys sorted by lexicographic comparison of their UTF-8 byte sequences;
- object members separated by `,` and `:` with no insignificant whitespace;
- array order preserved;
- JSON `null`, booleans, strings, arrays, and objects allowed;
- integer JSON numbers allowed only within the JavaScript safe-integer range (`[-9007199254740991, 9007199254740991]`);
- decimal values MUST be strings to avoid floating-point representation differences between languages;
- strings MUST contain valid UTF-8; control characters are escaped using JSON escapes and other Unicode characters remain UTF-8 encoded;
- SHA-256 of the canonical UTF-8 bytes, rendered as lowercase hexadecimal.

The normative interoperability vectors are `vectors/protocol-v1-canonical.json` and `vectors/protocol-v1-unicode.json`.

## 3. Envelope

The v1 application envelope is:

```json
{
  "v": 1,
  "kind": "request|response|quote|attestation",
  "requestId": "unique-request-id",
  "sender": "agent-identity",
  "recipient": "agent-identity",
  "createdAt": 1700000000000,
  "expiresAt": 1700000030000,
  "payload": {}
}
```

`createdAt` and `expiresAt` are Unix milliseconds and MUST be integers within the canonical safe-integer range. `expiresAt` MUST be greater than `createdAt`.

## 4. Capability manifest

A capability manifest binds a versioned capability to an agent identity and its NKN address. The signed representation MUST include the NKN address and application public-key fingerprint. A verifier MUST check both the signature and identity/address binding before accepting a quote or attestation.

## 5. Quote

A quote advertises a capability, expected latency and optional economic metadata. Quotes are advisory in v1 and do not create a payment obligation.

## 6. Execution attestation

An execution attestation binds at minimum:

- request ID;
- agent identity;
- task digest;
- result digest;
- operator ID;
- provider/source ID;
- capture time;
- protocol/domain version.

A signature proves authorship of the attestation. It does not prove the underlying claim is true.

## 7. Verification

A verifier MUST apply deterministic policy after checking signature validity, task/result binding, freshness, and replay protection. Domain policies may additionally require:

- minimum independent providers;
- unique operator IDs;
- unique provider IDs;
- source diversity;
- quorum;
- explicit Byzantine/outlier rejection;
- critical-finding veto;
- risk thresholds;
- exact policy-version matching.

## 8. Transport independence

The protocol core MUST NOT depend on NKN. NKN is the current transport/addressability implementation. A conforming implementation may use another transport while preserving v1 canonical bytes and verification semantics.

## 9. Interoperability

A language implementation is v1-compatible only when it matches every normative vector byte-for-byte and hash-for-hash. The repository includes a JavaScript implementation and a Go reference implementation. Future Rust/other implementations MUST consume the same vectors before participating in live interoperability tests.

## 10. Future economic layer

Escrow, stake, slashing, dispute resolution, portable reputation and settlement are intentionally out of scope for v1 safety. A later protocol version may bind a verified task receipt to an NKN payment or escrow receipt after identity, Sybil and collusion assumptions are stronger.
