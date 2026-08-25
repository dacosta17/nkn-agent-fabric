import assert from 'node:assert/strict';
import test from 'node:test';
import { auditQuorum, verifyQuorumResult } from '../src/agents/auditor.js';
import { digest } from '../src/lib/canonical.js';

function response(peer, price, operatorId, providerId, sourceGroup = providerId) {
  const result = { symbol: 'NKNUSDT', price, timestamp: Date.now(), source: providerId };
  return { peer, value: { result, evidence: { digest: digest(result), source: providerId, operatorId, providerId, sourceGroup } } };
}

test('quorum requires independent operators, providers and source groups', () => {
  const responses = [response('peer-a', 1, 'op-a', 'provider-a'), response('peer-b', 1.01, 'op-b', 'provider-b')];
  const result = auditQuorum({ requestId: 'r1', responses, expectedPeers: ['peer-a', 'peer-b'], elapsedMs: 1 });
  assert.equal(result.quorum, true);
  assert.deepEqual(result.diversity, { distinctOperators: 2, distinctProviders: 2, distinctSourceGroups: 2 });
  assert.equal(verifyQuorumResult(result, { expectedPeers: ['peer-a', 'peer-b'] }).valid, true);
});

test('same provider cannot satisfy provider diversity', () => {
  const responses = [response('peer-a', 1, 'op-a', 'provider-a'), response('peer-b', 1.01, 'op-b', 'provider-a')];
  const result = auditQuorum({ requestId: 'r2', responses, expectedPeers: ['peer-a', 'peer-b'], elapsedMs: 1 });
  assert.equal(result.quorum, false);
  assert.equal(result.diversity.distinctProviders, 1);
});

test('coordinator cannot silently shrink the required peer set', () => {
  assert.throws(() => auditQuorum({ requestId: 'r3', responses: [response('peer-a', 1, 'op-a', 'provider-a')], expectedPeers: ['peer-a', 'peer-b'], elapsedMs: 1 }), /peer-set mismatch/);
});

test('independent verifier rejects a tampered result bundle', () => {
  const result = auditQuorum({ requestId: 'r4', responses: [response('peer-a', 1, 'op-a', 'provider-a'), response('peer-b', 1, 'op-b', 'provider-b')], expectedPeers: ['peer-a', 'peer-b'], elapsedMs: 1 });
  const tampered = { ...result, quorum: false };
  assert.equal(verifyQuorumResult(tampered, { expectedPeers: ['peer-a', 'peer-b'] }).valid, false);
});

test('independent verifier recomputes a quorum decision instead of trusting metadata', () => {
  const result = auditQuorum({ requestId: 'r5', responses: [response('peer-a', 1, 'op-a', 'provider-a'), response('peer-b', 1.01, 'op-b', 'provider-b')], expectedPeers: ['peer-a', 'peer-b'], elapsedMs: 1 });
  const forged = { ...result, quorum: false, resultDigest: digest({
    version: result.version,
    type: result.type,
    requestId: result.requestId,
    quorum: false,
    observationCount: result.observationCount,
    requiredPeers: result.requiredPeers,
    diversity: result.diversity,
    independence: result.independence,
    relativeSpread: result.relativeSpread,
    elapsedMs: result.elapsedMs,
    observations: result.observations,
  }) };
  assert.equal(verifyQuorumResult(forged, { expectedPeers: ['peer-a', 'peer-b'] }).valid, false);
});
