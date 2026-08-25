import assert from 'node:assert/strict';
import test from 'node:test';
import { percentile, settleAll, summarizeSamples, validateLatencyConfig, withTimeout } from '../src/lib/latency-benchmark.js';

test('percentile returns deterministic values and handles empty samples', () => {
  assert.equal(percentile([], 50), null);
  assert.equal(percentile([3, 1, 2], 50), 2);
  assert.equal(percentile([3, 1, 2], 95), 3);
});

test('latency configuration rejects unsafe values', () => {
  assert.throws(() => validateLatencyConfig({ samples: 0, warmup: 1, fanout: 1, payloadBytes: 1, timeoutMs: 100 }), /samples/);
  assert.throws(() => validateLatencyConfig({ samples: 1, warmup: 1, fanout: 0, payloadBytes: 1, timeoutMs: 100 }), /fanout/);
  assert.throws(() => validateLatencyConfig({ samples: 1, warmup: 1, fanout: 1, payloadBytes: 1, timeoutMs: 0 }), /timeoutMs/);
});

test('withTimeout fails fast without leaking a late rejection', async () => {
  await assert.rejects(() => withTimeout(() => new Promise((_, reject) => setTimeout(() => reject(new Error('late failure')), 50)), 5, 'NKN send'), /timed out/);
});

test('settleAll preserves input order and isolates individual failures', async () => {
  const result = await settleAll(['a', 'b', 'c'], async (item) => {
    if (item === 'b') throw new Error('boom');
    return item.toUpperCase();
  });
  assert.deepEqual(result.map((entry) => entry.index), [0, 1, 2]);
  assert.deepEqual(result.map((entry) => entry.ok), [true, false, true]);
  assert.equal(result[0].value, 'A');
  assert.equal(result[1].error, 'boom');
});

test('summarizeSamples reports success rate and ignores failed latency samples', () => {
  const report = summarizeSamples([
    { ok: true, elapsedMs: 10 },
    { ok: true, elapsedMs: 20 },
    { ok: false, elapsedMs: 99, error: 'timeout' },
  ]);
  assert.equal(report.attempted, 3);
  assert.equal(report.successful, 2);
  assert.equal(report.failed, 1);
  assert.equal(report.successRatePct, 66.67);
  assert.equal(report.latencyMs.p50, 10);
  assert.deepEqual(report.errors, ['timeout']);
});
