export function percentile(values, p) {
  if (!values.length) return null;
  if (!Number.isFinite(p) || p <= 0 || p > 100) throw new RangeError('percentile must be > 0 and <= 100');
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return Number(sorted[index].toFixed(2));
}

export function validateLatencyConfig({ samples, warmup, fanout, payloadBytes, timeoutMs }) {
  for (const [name, value] of Object.entries({ samples, warmup, fanout, payloadBytes, timeoutMs })) {
    if (!Number.isInteger(value) || value < 0) throw new RangeError(`${name} must be a non-negative integer`);
  }
  if (samples < 1) throw new RangeError('samples must be >= 1');
  if (fanout < 1) throw new RangeError('fanout must be >= 1');
  if (timeoutMs < 1) throw new RangeError('timeoutMs must be >= 1');
}

export async function withTimeout(operation, timeoutMs, label = 'operation') {
  let timer;
  let settled = false;
  const promise = Promise.resolve().then(operation);
  // Prevent a late NKN SDK rejection from becoming an unhandled rejection after the timeout wins.
  promise.catch(() => {});
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
  } finally {
    settled = true;
    if (timer) clearTimeout(timer);
    void settled;
  }
}

export async function settleAll(items, worker) {
  const results = await Promise.all(items.map(async (item, index) => {
    try {
      return { index, ok: true, value: await worker(item, index) };
    } catch (error) {
      return { index, ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }));
  return results.sort((a, b) => a.index - b.index);
}

export function summarizeSamples(samples) {
  const successful = samples.filter((sample) => sample.ok).map((sample) => sample.elapsedMs);
  const failed = samples.filter((sample) => !sample.ok);
  return {
    attempted: samples.length,
    successful: successful.length,
    failed: failed.length,
    successRatePct: Number(((successful.length / Math.max(1, samples.length)) * 100).toFixed(2)),
    errors: failed.map((sample) => sample.error),
    latencyMs: {
      p50: percentile(successful, 50),
      p95: percentile(successful, 95),
      p99: percentile(successful, 99),
    },
  };
}
