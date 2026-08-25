import assert from 'node:assert/strict';
import test from 'node:test';
import { buildScenario, matrixDigest, runAttackMatrix, simulateScenario } from '../src/lib/adversarial-simulator.js';

test('one malicious operator cannot win a two-of-three honest quorum', () => {
  const result = simulateScenario(buildScenario({ honestOperators: 3, maliciousOperators: 1, sybilIdentitiesPerOperator: 1, quorum: 2 }));
  assert.equal(result.metrics.safetyViolation, false);
  assert.equal(result.metrics.livenessFailure, false);
});

test('Sybil identities can break naive identity-count quorum', () => {
  const result = simulateScenario(buildScenario({ honestOperators: 2, maliciousOperators: 1, sybilIdentitiesPerOperator: 5, quorum: 2 }));
  assert.equal(result.metrics.distinctOperators, 3);
  assert.equal(result.metrics.maliciousIdentities, 5);
  assert.equal(result.metrics.safetyViolation, true);
});

test('operator diversity is distinct from identity diversity', () => {
  const result = simulateScenario(buildScenario({ honestOperators: 3, maliciousOperators: 1, sybilIdentitiesPerOperator: 5, quorum: 2 }));
  assert.equal(result.metrics.distinctMaliciousOperators, 1);
  assert.equal(result.metrics.maliciousIdentities, 5);
});

test('attack matrix is deterministic', () => {
  const a = runAttackMatrix({ maxHonestOperators: 3, maxMaliciousOperators: 2, sybilFactors: [1, 3], quorum: 2 });
  const b = runAttackMatrix({ maxHonestOperators: 3, maxMaliciousOperators: 2, sybilFactors: [1, 3], quorum: 2 });
  assert.deepEqual(a, b);
  assert.equal(matrixDigest(a), matrixDigest(b));
});

test('liveness fails when fewer honest operators remain than quorum', () => {
  const result = simulateScenario(buildScenario({ honestOperators: 1, maliciousOperators: 4, sybilIdentitiesPerOperator: 1, quorum: 2 }));
  assert.equal(result.metrics.livenessFailure, true);
});
