import { createNknTransport } from '../lib/nkn-transport.js';
import { createResponse, parseEnvelope, BoundedTtlSet } from '../lib/runtime.js';
import { validateObservation } from '../lib/tasks.js';
import { digest } from '../lib/canonical.js';

const source = process.env.SOURCE ?? 'synthetic';
const transport = await createNknTransport({ identifier: `${source}-${process.pid}` });
const seen = new BoundedTtlSet();

async function observe(task) {
  if (task.type !== 'market-observation.v1') throw new Error('unsupported task');
  const base = source === 'synthetic' ? 0.01 : 0;
  const result = { symbol: task.symbol, price: Number((base + 0.01).toFixed(8)), timestamp: Date.now(), source };
  validateObservation(result);
  return result;
}

transport.onMessage(async ({ src, payload }) => {
  try {
    const env = parseEnvelope(payload);
    if (env.recipient !== transport.addr || seen.has(env.requestId)) return false;
    seen.add(env.requestId);
    if (env.kind !== 'request') return false;
    const result = await observe(env.payload.task);
    const evidence = { source, capturedAt: result.timestamp, digest: digest(result) };
    return JSON.stringify(createResponse({ requestId: env.requestId, sender: transport.addr, recipient: src, result, evidence }));
  } catch (err) {
    return JSON.stringify({ error: err.message });
  }
});

await new Promise((resolve) => transport.onConnect(resolve));
console.log(JSON.stringify({ role: 'worker', source, address: transport.addr }));
