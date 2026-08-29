import { performance } from 'node:perf_hooks';
import { randomUUID } from 'node:crypto';
import { createNknTransport } from '../lib/nkn-transport.js';
import { createRequest, createResponse, parseEnvelope } from '../lib/runtime.js';
import { percentile, settleAll, summarizeSamples, validateLatencyConfig, withTimeout } from '../lib/latency-benchmark.js';

const SAMPLES = Number(process.env.NKN_LATENCY_SAMPLES ?? 20);
const WARMUP = Number(process.env.NKN_LATENCY_WARMUP ?? 5);
const FANOUT = Number(process.env.NKN_LATENCY_FANOUT ?? 4);
const PAYLOAD_BYTES = Number(process.env.NKN_LATENCY_PAYLOAD_BYTES ?? 256);
const REQUEST_TIMEOUT_MS = Number(process.env.NKN_LATENCY_REQUEST_TIMEOUT_MS ?? 12_000);
const CONNECT_TIMEOUT_MS = Number(process.env.NKN_LATENCY_CONNECT_TIMEOUT_MS ?? 45_000);
const CONNECT_ATTEMPTS = Number(process.env.NKN_LATENCY_CONNECT_ATTEMPTS ?? 3);
const MIN_SUCCESS_RATE_PCT = Number(process.env.NKN_LATENCY_MIN_SUCCESS_RATE_PCT ?? 80);
const ALLOW_UNAVAILABLE = process.env.NKN_LATENCY_ALLOW_UNAVAILABLE === 'true';

validateLatencyConfig({ samples: SAMPLES, warmup: WARMUP, fanout: FANOUT, payloadBytes: PAYLOAD_BYTES, timeoutMs: REQUEST_TIMEOUT_MS });
if (!Number.isFinite(MIN_SUCCESS_RATE_PCT) || MIN_SUCCESS_RATE_PCT <= 0 || MIN_SUCCESS_RATE_PCT > 100) throw new RangeError('MIN_SUCCESS_RATE_PCT must be > 0 and <= 100');
if (!Number.isFinite(CONNECT_TIMEOUT_MS) || CONNECT_TIMEOUT_MS <= 0) throw new RangeError('CONNECT_TIMEOUT_MS must be > 0');
if (!Number.isInteger(CONNECT_ATTEMPTS) || CONNECT_ATTEMPTS < 1) throw new RangeError('CONNECT_ATTEMPTS must be an integer >= 1');

async function rpc(client, address, payload) {
  const request = createRequest({ requestId: randomUUID(), sender: client.addr, recipient: address, task: payload });
  const started = performance.now();
  await withTimeout(() => client.send(address, JSON.stringify(request)), REQUEST_TIMEOUT_MS, `NKN send to ${address}`);
  return performance.now() - started;
}

async function runFanout(addresses, coordinator, payload, mode) {
  const started = performance.now();
  const results = [];

  if (mode === 'parallel') {
    results.push(...await settleAll(addresses, (address) => rpc(coordinator, address, payload)));
  } else {
    for (let index = 0; index < addresses.length; index += 1) {
      try {
        results.push({ index, ok: true, value: await rpc(coordinator, addresses[index], payload) });
      } catch (error) {
        results.push({ index, ok: false, error: error instanceof Error ? error.message : String(error) });
      }
    }
  }

  const elapsedMs = performance.now() - started;
  const successful = results.filter((result) => result.ok).length;
  return { ok: successful === addresses.length, elapsedMs, results };
}

async function createBenchmarkTransport(identifier) {
  return createNknTransport({
    identifier,
    numSubClients: 1,
    connectTimeoutMs: CONNECT_TIMEOUT_MS,
    connectAttempts: CONNECT_ATTEMPTS,
  });
}

async function closeTransports(transports) {
  await Promise.allSettled(transports.filter(Boolean).map((transport) => Promise.resolve(transport.close())));
}

async function createBenchmarkTopology() {
  const identifiers = [
    `latency-coordinator-${process.pid}-${randomUUID().slice(0, 8)}`,
    ...Array.from({ length: FANOUT }, (_, index) => `latency-worker-${index}-${process.pid}-${randomUUID().slice(0, 8)}`),
  ];

  // NKN connectivity is an external dependency. Create all clients concurrently so
  // an unavailable bootstrap/relay path is bounded by one connect timeout, not N
  // sequential timeouts. Never leave partially-created clients running.
  const settled = await Promise.allSettled(identifiers.map((identifier) => createBenchmarkTransport(identifier)));
  const transports = settled.map((result) => result.status === 'fulfilled' ? result.value : null);
  const failure = settled.find((result) => result.status === 'rejected');

  if (failure) {
    await closeTransports(transports);
    throw failure.reason instanceof Error ? failure.reason : new Error(String(failure.reason));
  }

  return { coordinator: transports[0], workers: transports.slice(1) };
}

async function verifyWarmup(addresses, coordinator, payload) {
  const results = await settleAll(addresses, (address) => rpc(coordinator, address, payload));
  const failedWarmup = results.find((result) => !result.ok);
  if (failedWarmup) {
    throw new Error(`NKN warmup unavailable: ${failedWarmup.error ?? 'request failed'}`);
  }
}

async function main() {
  let coordinator;
  let workers = [];

  try {
    ({ coordinator, workers } = await createBenchmarkTopology());

    workers.forEach((transport) => {
      transport.onMessage(async ({ src, payload }) => {
        const env = parseEnvelope(payload);
        if (env.recipient !== transport.addr || env.kind !== 'request') return false;
        return JSON.stringify(createResponse({ requestId: env.requestId, sender: transport.addr, recipient: src, result: { ok: true } }));
      });
    });

    const addresses = workers.map((worker) => worker.addr);
    const payload = { type: 'latency-ping.v1', bytes: 'x'.repeat(Math.max(0, PAYLOAD_BYTES)) };

    // The first warmup is an availability gate. If NKN is unreachable, stop here.
    // This prevents an external dependency outage from being amplified into dozens
    // of timeout cycles while still retaining multiple warmup samples when healthy.
    await verifyWarmup(addresses, coordinator, payload);
    for (let i = 1; i < WARMUP; i += 1) {
      await verifyWarmup(addresses, coordinator, payload);
    }

    const serial = [];
    const parallel = [];
    for (let i = 0; i < SAMPLES; i += 1) {
      const serialSample = await runFanout(addresses, coordinator, payload, 'serial');
      serial.push({ ok: serialSample.ok, elapsedMs: serialSample.elapsedMs, error: serialSample.results.find((result) => !result.ok)?.error });

      const parallelSample = await runFanout(addresses, coordinator, payload, 'parallel');
      parallel.push({ ok: parallelSample.ok, elapsedMs: parallelSample.elapsedMs, error: parallelSample.results.find((result) => !result.ok)?.error });
    }

    const serialReport = summarizeSamples(serial);
    const parallelReport = summarizeSamples(parallel);
    const overallRequests = [...serial, ...parallel];
    const overallSuccessRatePct = Number(((overallRequests.filter((sample) => sample.ok).length / overallRequests.length) * 100).toFixed(2));

    if (!serialReport.successful || !parallelReport.successful) throw new Error('latency benchmark produced no complete successful samples');
    if (overallSuccessRatePct < MIN_SUCCESS_RATE_PCT) throw new Error(`NKN latency success rate ${overallSuccessRatePct}% is below required ${MIN_SUCCESS_RATE_PCT}%`);

    const serialP50 = percentile(serial.filter((sample) => sample.ok).map((sample) => sample.elapsedMs), 50);
    const parallelP50 = percentile(parallel.filter((sample) => sample.ok).map((sample) => sample.elapsedMs), 50);
    const report = {
      samples: SAMPLES,
      warmup: WARMUP,
      fanout: FANOUT,
      payloadBytes: PAYLOAD_BYTES,
      requestTimeoutMs: REQUEST_TIMEOUT_MS,
      connectTimeoutMs: CONNECT_TIMEOUT_MS,
      connectAttempts: CONNECT_ATTEMPTS,
      minSuccessRatePct: MIN_SUCCESS_RATE_PCT,
      serial: serialReport,
      parallel: parallelReport,
      overallSuccessRatePct,
      parallelP50ReductionPct: Number(((1 - parallelP50 / serialP50) * 100).toFixed(2)),
    };
    console.log(JSON.stringify({ phase: 'latency-benchmark', report }, null, 2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!ALLOW_UNAVAILABLE) throw error;
    console.log(JSON.stringify({ phase: 'latency-benchmark', status: 'unavailable', reason: message }, null, 2));
  } finally {
    await closeTransports(workers);
    if (coordinator) await Promise.resolve(coordinator.close()).catch(() => {});
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ phase: 'latency-benchmark-failed', error: error.stack ?? error.message }));
  process.exitCode = 1;
});
