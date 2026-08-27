# Distributed Verification

The coordinator is an orchestration component, not a trust anchor.

A verification round is represented by a signed-evidence set containing:

- deterministic `roundId` and task digest;
- explicit participant set and quorum policy;
- one signed verification vote per participant;
- signer identity bound through the existing agent manifest;
- an evidence digest that an independent verifier can reproduce.

An independent verifier can therefore reconstruct the decision without trusting the coordinator's aggregate result.

## Security boundary

NKN provides decentralized transport and authenticated client addressing. The application protocol does not treat NKN transport as an oracle for application truth. Agent signatures authenticate who asserted an observation or vote. Independence policy and quorum policy define the application fault model.

This is **verifiable application-level quorum**, not a claim to implement a general Byzantine Fault Tolerant consensus protocol. The design intentionally fails closed when the configured quorum cannot be established.

## Why this matters

A coordinator may route a task, collect evidence, or publish a convenience summary. It cannot manufacture a valid quorum because the final decision is reproducible from participant-signed evidence. This is the minimum architectural step required before treating the coordinator as replaceable infrastructure rather than a trusted control-plane authority.
