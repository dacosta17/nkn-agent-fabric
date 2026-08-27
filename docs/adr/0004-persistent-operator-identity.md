# ADR 0004: Persistent Operator Identity

## Status

Proposed

## Context

The fabric currently creates application signing keys at process start. NKN itself supports persistent client identity through a secret seed; an NKN address is derived from the client public key and identifier, so reusing the seed preserves the cryptographic identity across restarts. The NKN SDK explicitly supports constructing a `Client`/`MultiClient` from an existing secret seed.

A production-oriented agent therefore needs two persistent identities:

1. **Application identity** — signs manifests, attestations, and verification votes.
2. **NKN transport identity** — the secret seed that controls the NKN public key embedded in the agent address.

These identities are related by the existing signed NKN identity-binding proof, but they are not the same key and must not be conflated.

## Decision

Provide an optional persistent operator identity profile containing:

- an Ed25519 application private key,
- the corresponding application public key,
- a 32-byte NKN client seed,
- a deterministic application-key fingerprint.

The profile is encrypted at rest using:

- scrypt for password-based key derivation,
- AES-256-GCM for authenticated encryption,
- a unique random salt and IV per profile,
- filesystem permissions of `0700` for the containing directory and `0600` for the profile file.

The plaintext passphrase is never written to disk or included in a manifest.

The worker can opt into persistence with:

- `OPERATOR_IDENTITY_FILE`
- `OPERATOR_IDENTITY_PASSPHRASE`

Both variables are required together. Without them, the existing ephemeral test/demo behavior remains unchanged.

When a persistent profile is loaded, the same application key and NKN seed are reused. This gives the agent continuity across restarts and makes the NKN endpoint advertised in the manifest stable for the same identifier.

## Security properties

- Wrong passphrases fail closed.
- AES-GCM authentication detects file tampering.
- The private key and NKN seed are never logged.
- Local identity material is excluded from Git via `.gitignore`.
- The NKN seed is passed directly to the official NKN SDK and is not used as the application signing key.
- Identity rotation is intentionally not implicit. A future rotation mechanism must create an explicit successor binding and revocation policy rather than silently replacing keys.

## Non-goals

This ADR does not claim to provide:

- hardware-backed key protection,
- a remote HSM/KMS,
- ERC-8004 on-chain registration,
- reputation,
- Sybil resistance,
- or Byzantine consensus.

Those are separate trust layers and will be evaluated independently.
