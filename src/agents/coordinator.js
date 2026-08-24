import { randomUUID } from 'node:crypto';
import { createNknTransport } from '../lib/nkn-transport.js';
import { createRequest, parseEnvelope, BoundedTtlSet } from '../lib/runtime.js';
import { makeObservationTask } from '../lib/tasks.js';

const transport = await createNknTransport({ identifier: `coord-${process.pid}` });
const seen = new BoundedTtlSet();
const peers = process.argv.slice(2);
if (peers.length < 2) { console.error('usage: npm run agent:coordinator -- <worker-address-1> <worker-address-2>'); process.exit(2); }
const pending = new Map();
const requestId = randomUUID();
const task = makeObservationTask({ requestId });

transport.onMessage(async ({ src, payload }) => {
  try {
    const env = parseEnvelope(payload);
    if (env.recipient !== transport.addr || seen.has(env.requestId + src)) return false;
    seen.add(env.requestId + src);
    if (env.kind === 'response') {
      pending.get(env.requestId)?.push({ src, response: env.payload });
      if (pending.get(env.requestId)?.length === peers.length) {
        console.log(JSON.stringify({ requestId, responses: pending.get(env.requestId) }, null, 2));
        process.exit(0);
      }
    }
  } catch (err) { console.error('message rejected:', err.message); }
  return undefined;
});

await new Promise((resolve) => transport.onConnect(resolve));
pending.set(requestId, []);
for (const peer of peers) {
  const envelope = createRequest({ requestId, sender: transport.addr, recipient: peer, task });
  await transport.send(peer, JSON.stringify(envelope));
}
