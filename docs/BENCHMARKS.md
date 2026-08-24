# Benchmark methodology

## Goal

Measure the properties that matter for a verifiable agent network without comparing unlike systems unfairly.

## Current benchmark

The live integration measures:

- NKN packet round-trip latency;
- NKN session smoke path;
- consensus rounds with honest and Byzantine providers;
- evidence freshness and digest validation;
- survival after adversarial-worker failure;
- quorum failure after insufficient honest sources remain;
- a localhost HTTP baseline.

The localhost HTTP result is intentionally described as a **lower bound**, not a production centralized-network comparison.

## What a serious public comparison should add

A publishable performance comparison should deploy the same agent protocol in at least two equivalent multi-region environments:

1. NKN transport;
2. centralized WebSocket/HTTP transport;
3. identical task payloads;
4. identical provider set;
5. identical retry policy;
6. identical regions and concurrency.

Report p50, p95, p99, success rate, retry rate, bandwidth overhead, and behavior under partial failure.

## Reproducibility

Run the deterministic suite with:

```bash
npm install
npm run check
npm test
npm run test:domains
```

Run the live NKN suite with:

```bash
npm run integration:nkn
```

The live suite uses public endpoints and therefore can encounter provider rate limits or outages. A provider 429 is not an NKN transport failure and should be reported separately.

## Interpretation rule

Never turn one successful benchmark into a general claim such as "NKN is faster". Benchmark conclusions must name the topology, regions, concurrency, payload size, retry policy, and provider conditions.
