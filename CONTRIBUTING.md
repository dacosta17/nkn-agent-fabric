# Contributing

Thanks for helping improve the NKN Verifiable Agent Network.

## Development principles

This project is a research-grade protocol POC. Contributions should preserve the distinction between:

- transport authenticity (provided by NKN),
- application identity and attestations,
- evidence provenance,
- deterministic domain validation,
- economic or reputation assumptions.

Do not add an LLM as the final security authority. Models may propose, classify, or summarize; deterministic validators must remain authoritative for acceptance decisions.

## Before opening a PR

Run:

```bash
npm install
npm run check
npm test
npm run test:domains
```

Live NKN tests require network access and may depend on public third-party APIs. They are intentionally separate from the deterministic test suite.

## PR expectations

Every protocol or security-sensitive change should include:

1. a threat-model impact assessment;
2. positive and negative tests;
3. updated protocol documentation when message or evidence formats change;
4. reproducible benchmark notes when performance claims change;
5. an explicit statement when a change introduces an economic, identity, or decentralization assumption.

Avoid committing secrets, wallet seeds, private keys, API credentials, or personally identifying test data.

## Commit hygiene

Use small, reviewable commits where practical and describe protocol/security implications in the PR body. Signed commits are welcome.
