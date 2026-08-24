# Security Policy

## Scope

This repository contains a research-grade distributed-agent protocol POC. It is not a production financial system and the current DeFi implementation does not execute transactions.

## Reporting a vulnerability

Please do not disclose a suspected security vulnerability in a public issue.

Use GitHub's private vulnerability reporting for this repository when available. If private reporting is not enabled, contact the repository owner through GitHub before disclosing exploit details publicly.

Please include:

- affected commit or release;
- reproduction steps;
- security impact;
- whether the issue affects NKN transport, application identity, evidence integrity, domain validation, or economic assumptions;
- any proposed mitigation.

## Security boundaries

A valid NKN message proves transport-level authenticity; it does not prove the truth of an external observation. Application attestations prove who signed a claim and bind it to evidence digests, timestamps, and task identity. They do not eliminate correlated-source risk, collusion, or Sybil attacks.

Do not use this software with production private keys or unattended financial authority without an independent security review.
