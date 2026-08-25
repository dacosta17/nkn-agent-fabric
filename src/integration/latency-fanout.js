import { performance } from 'node:perf_hooks';
import { randomUUID } from 'node:crypto';
import { createNknTransport } from '../lib/nkn-transport.js';
import { mapConcurrent } from '../lib/concurrency.js';
import { createRequest, createResponse, parseEnvelope } from '../lib/runtime.js';

const SAMPLES = Number(process.env.NKN_LATENCY_SAMPLES ?? 20);
const WARMUP = Number(process.env.NKN_LATENCY_WARMUP ?? 5);
const FANOUT = Number(process.env.NKN_LATENCY_FANOUT ?? 4);
const PAYLOAD_BYTES = Number(process.env.NKN_LATENCY_PAYLOAD_BYTES ?? 256);

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return Number(sorted[index].toFixed(2));
}

async function rpc(client, address, payload) {
  const request = createRequest({ requestId: randomUUID(), sender: client.addr, recipient: address, task: payload });
  const started = performance.now();
  await client.send(address, JSON.stringify(request));
  return performance.now() - started;
}

async function main() {
  const coordinator = await createNknTransport({ identifier: `latency-coordinator-${process.pid}-${randomUUID().slice(0, 8)}`, numSubClients: 1 });
  const workers = await Promise.all(Array.from({ length: FANOUT }, async (_, index) => {
    const transport = await createNknTransport({ identifier: `latency-worker-${index}-${process.pid}-${randomUUID().slice(0, 8)}`, numSubClients: 1 });
    transport.onMessage(async ({ src, payload }) => {
      const env = parseEnvelope(payload);
      if (env.recipient !== transport.addr || env.kind !== 'request') return false;
      return JSON.stringify(createResponse({ requestId: env.requestId, sender: transport.addr, recipient: src, result: { ok: true } }));
    });
    return transport;
  }));

  try {
    const addresses = workers.map((worker) => worker.addr);
    const payload = { type: 'latency-ping.v1', bytes: 'x'.repeat(Math.max(0, PAYLOAD_BYTES)) };

    for (let i = 0; i < WARMUP; i += 1) {
      await mapConcurrent(addresses, (address) => rpc(coordinator, address, payload), FANOUT);
    }

    const serial = [];
    const parallel = [];
    for (let i = 0; i < SAMPLES; i += 1) {
      const serialStart = performance.now();
      for (const address of addresses) await rpc(coordinator, address, payload);
      serial.push(performance.now() - serialStart);

      const parallelStart = performance.now();
      await mapConcurrent(addresses, (address) => rpc(coordinator, address, payload), FANOUT);
      parallel.push(performance.now() - parallelStart);
    }

    const report = {
      samples: SAMPLES,
      warmup: WARMUP,
      fanout: FANOUT,
      payloadBytes: PAYLOAD_BYTES,
      serialMs: { p50: percentile(serial, 50), p95: percentile(serial, 95), p99: percentile(serial, 99) },
      parallelMs: { p50: percentile(parallel, 50), p95: percentile(parallel, 95), p99: percentile(parallel, 99) },
      parallelP50ReductionPct: Number(((1 - percentile(parallel, 50) / percentile(serial, 50)) * 100).toFixed(2)),
    };
    console.log(JSON.stringify({ phase: 'latency-benchmark', report }, null, 2));
  } finally {
    await Promise.allSettled(workers.map((worker) => worker.close()));
    await coordinator.close();
  }
}

main().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
