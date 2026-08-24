import { randomUUID } from 'node:crypto';
import { createNknTransport } from '../lib/nkn-transport.js';
import { createRequest } from '../lib/runtime.js';
import { makeObservationTask } from '../lib/tasks.js';
import { auditQuorum } from './auditor.js';

const transport = await createNknTransport({ identifier: `coord-${process.pid}` });
const peers = process.argv.slice(2);
if (peers.length < 2) { console.error('usage: npm run agent:coordinator -- <worker-address-1> <worker-address-2>'); process.exit(2); }
const expectedPeers = [...new Set(peers)].sort();
if (expectedPeers.length !== peers.length) throw new Error('duplicate peer in participant set');
const requestId = randomUUID();
const task = makeObservationTask({ requestId });
const startedAt = performance.now();

const responses = await Promise.all(expectedPeers.map(async (peer) => {
  const envelope = createRequest({ requestId, sender: transport.addr, recipient: peer, task: { ...task, expectedPeers } });
  const raw = await transport.send(peer, JSON.stringify(envelope));
  const value = typeof raw === 'string' ? JSON.parse(raw) : JSON.parse(Buffer.from(raw).toString('utf8'));
  return { peer, value };
}));

const result = auditQuorum({ requestId, responses, expectedPeers, elapsedMs: performance.now() - startedAt });
console.log(JSON.stringify(result, null, 2));
