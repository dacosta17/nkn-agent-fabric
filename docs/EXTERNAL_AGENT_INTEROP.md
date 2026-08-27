# ERC-8004 ↔ NKN external-agent interoperability

This integration binds an ERC-8004 agent registration to an NKN endpoint without replacing ERC-8004, A2A, or NKN primitives.

## Trust model

1. ERC-8004 Identity Registry provides the global `agentRegistry` + `agentId` identity and an `agentURI` registration file.
2. The registration file advertises an `NKN` service whose endpoint is the agent's NKN address.
3. The agent publishes the existing signed NKN identity-binding proof and capability manifest.
4. The verifier checks that the NKN transport source equals the signed binding and that the application signature is valid.
5. The verifier can optionally check membership in the project's signed operator registry.
6. For EVM registries, `resolveAndVerifyOnChainAgent()` reads `ownerOf(agentId)` and `tokenURI(agentId)` through standard JSON-RPC `eth_call`, then verifies that the resolved registration references the exact on-chain `agentRegistry` and `agentId`.

The result is an **interop/admission primitive**, not a new identity registry and not permissionless Sybil resistance.

## Why this is different from A2A

A2A already defines agent cards, discovery and application authentication. This project does not reimplement those semantics. The NKN service is an additional transport endpoint and the Agent Fabric layer adds independently verifiable evidence/quorum semantics. A2A can remain the task/application protocol while NKN carries the agent-to-agent transport.

## What is deliberately not claimed

- Reading `ownerOf` does not prove that an Ed25519 application key is controlled by the EVM owner.
- ERC-8004 registration does not prove that an advertised capability is honest or functional.
- NKN addressability does not prove real-world operator independence.
- The fabric quorum is application-level verification, not a replacement for blockchain consensus.

A future owner-to-application-key binding can use an explicit wallet signature if a production deployment needs that stronger property.
