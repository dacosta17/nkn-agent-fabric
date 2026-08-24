# Protocol v1 package

This directory contains the language-neutral protocol core. It MUST NOT depend on NKN transport, LLM providers, HTTP APIs, or wallet code.

The v1 package defines deterministic canonical JSON and SHA-256 digests, plus the base message envelope.

## Canonical data model

Allowed JSON values are:

- null;
- boolean;
- UTF-8 string;
- arrays whose elements are canonical values;
- objects with string keys and canonical values;
- integer numbers only.

Decimal quantities MUST be represented as strings, for example `"0.00640918"`, not `0.00640918`.

Object keys are serialized in lexicographic order. Array order is preserved. No insignificant whitespace is emitted. UTF-8 is used. Canonical bytes are hashed with SHA-256 and represented as lowercase hexadecimal.

The shared vector at `vectors/protocol-v1-canonical.json` is normative for interoperability.

## Envelope v1

Required fields:

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

`createdAt` and `expiresAt` are Unix milliseconds and MUST be integers. A verifier MUST reject an unsupported version and invalid timestamp ordering before domain processing.

## Interoperability rule

Transport implementations are adapters. A JS, Go, Rust, or other implementation MUST produce identical canonical bytes and digests for the same protocol object before it can claim v1 interoperability.
