import test from 'node:test';
import assert from 'node:assert/strict';
import { makeEnvelope, assertFresh } from '../src/lib/protocol.js';
import { digest } from '../src/lib/canonical.js';
import { auditQuorum } from '../src/agents/auditor.js';

test('envelope freshness and canonical digest are deterministic', () => {
  const e = makeEnvelope({ kind: 'request', requestId: 'r1', sender: 'a', recipient: 'b', payload: { z: 1, a: 2 } });
  assert.doesNotThrow(() => assertFresh(e));
  assert.equal(digest({ a: 2, z: 1 }), digest({ z: 1, a: 2 }));
});

test('quorum requires two agreeing observations', () => {
  const responses = [
    { peer: 'a', value: { result: { symbol: 'NKNUSDT', price: 1, timestamp: Date.now(), source: 'coingecko' }, evidence: { digest: digest({ symbol: 'NKNUSDT', price: 1, timestamp: 0, source: 'coingecko' }) } } },
  ];
  assert.throws(() => auditQuorum({ requestId: 'r', responses, elapsedMs: 10 }));
});
