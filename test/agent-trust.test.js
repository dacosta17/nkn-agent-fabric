import assert from 'node:assert/strict';
import test from 'node:test';
import { createIdentity, signManifest, verifyManifest, createTaskQuote, verifySignedObject, createAttestation, verifyAttestation, ReputationBook } from '../src/lib/agent-trust.js';
import { digest } from '../src/lib/canonical.js';

test('signed capability manifest is bound to the NKN address and rejects tampering', () => {
  const identity = createIdentity();
  const manifest = signManifest({ nknAddress: 'demo-address', identity, capabilities: ['market-observation', 'ping'] });
  assert.equal(verifyManifest(manifest).valid, true);

  const tampered = { ...manifest, capabilities: ['admin'] };
  assert.equal(verifyManifest(tampered).valid, false);
});

test('task quote and execution attestation are independently verifiable', () => {
  const identity = createIdentity();
  const manifest = signManifest({ nknAddress: 'agent-1', identity, capabilities: ['market-observation'] });
  const quote = createTaskQuote({ requestId: 'req-1', agentId: 'agent-1', capability: 'market-observation', price: 0.01, identity });
  assert.equal(verifySignedObject(quote, manifest.publicKey).valid, true);

  const task = { symbol: 'NKNUSDT', round: 1 };
  const result = { price: 0.0067, source: 'demo' };
  const attestation = createAttestation({
    requestId: 'req-1',
    agentId: 'agent-1',
    taskDigest: digest(task),
    resultDigest: digest(result),
    source: 'demo',
    capturedAt: Date.now(),
    identity,
  });
  assert.equal(verifyAttestation(attestation, manifest).valid, true);
  assert.equal(verifyAttestation({ ...attestation, resultDigest: digest({ price: 9 }) }, manifest).valid, false);
});

test('reputation book rewards success and tracks conflicts', () => {
  const book = new ReputationBook({ decay: 0.2 });
  const first = book.record('agent-a', 'success');
  const second = book.record('agent-a', 'conflict');
  assert.ok(first.score > 0.5);
  assert.equal(second.conflicts, 1);
  assert.equal(second.attempts, 2);
  assert.ok(second.score < first.score);
});
