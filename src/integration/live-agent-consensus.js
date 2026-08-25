import { spawn } from 'node:child_process';
import { createNknTransport } from '../lib/nkn-transport.js';
import { createRequest } from '../lib/runtime.js';
import { makeObservationTask } from '../lib/tasks.js';
import { auditQuorum } from '../agents/auditor.js';

const workerConfigs = [
  { operatorId: 'demo-operator-a', source: 'coingecko', providerId: 'coingecko', sourceGroup: 'market-data-a' },
  { operatorId: 'demo-operator-b', source: 'binance', providerId: 'binance', sourceGroup: 'market-data-b' },
];

function waitForWorker(worker, timeoutMs = 60_000) {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const timeout = setTimeout(() => reject(new Error('worker startup timeout')), timeoutMs);
    worker.stdout.on('data', (chunk) => {
      buffer += chunk.toString();
      for (const line of buffer.split('\n').slice(0, -1)) {
        try {
          const message = JSON.parse(line);
          if (message.role === 'worker' && message.address) {
            clearTimeout(timeout);
            resolve(message);
            return;
          }
        } catch {}
      }
      buffer = buffer.split('\n').at(-1) ?? '';
    });
    worker.once('exit', (code) => {
      clearTimeout(timeout);
      if (code !== 0) reject(new Error(`worker exited before startup: ${code}`));
    });
  });
}

const workers = workerConfigs.map((config) => spawn(process.execPath, ['src/agents/worker.js'], {
  env: { ...process.env, ...Object.fromEntries(Object.entries(config).map(([key, value]) => [key.toUpperCase(), value])) },
  stdio: ['ignore', 'pipe', 'inherit'],
}));

try {
  const workerInfo = await Promise.all(workers.map(waitForWorker));
  const transport = await createNknTransport({ identifier: `demo-coordinator-${process.pid}` });
  const peers = workerInfo.map((worker) => worker.address).sort();
  const requestId = crypto.randomUUID();
  const task = makeObservationTask({ requestId });
  const startedAt = performance.now();
  const responses = await Promise.all(peers.map(async (peer) => {
    const envelope = createRequest({ requestId, sender: transport.addr, recipient: peer, task: { ...task, expectedPeers: peers } });
    const raw = await transport.send(peer, JSON.stringify(envelope));
    return { peer, value: JSON.parse(typeof raw === 'string' ? raw : Buffer.from(raw).toString('utf8')) };
  }));
  const result = auditQuorum({ requestId, responses, expectedPeers: peers, elapsedMs: performance.now() - startedAt });
  console.log(JSON.stringify({
    demo: 'live-nkn-agent-consensus',
    transport: 'NKN MultiClient',
    claim: 'independent agent observations can be transported and deterministically verified over NKN',
    result,
    limitation: 'This demo provisions distinct operator IDs but does not provide permissionless Sybil resistance; production deployments need an external operator registry, attestation, stake, or equivalent identity mechanism.',
  }, null, 2));
  await transport.close();
} finally {
  for (const worker of workers) worker.kill('SIGTERM');
}
