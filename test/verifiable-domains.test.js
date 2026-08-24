import test from 'node:test';
import assert from 'node:assert/strict';
import { createDomainTask, validateDomainResult, buildTaskEvidence } from '../src/domains/verifiable-domains.js';

const id = (n) => ({ operatorId: `operator-${n}`, providerId: `provider-${n}` });

test('intelligence requires independent operators and providers', () => {
  const task = createDomainTask('intelligence', { question: 'Q' });
  assert.equal(validateDomainResult(task, [
    { ...id(1), answer: 'A', sources: ['s1', 's2'] },
    { ...id(2), answer: 'A', sources: ['s3', 's4'] },
    { ...id(3), answer: 'B', sources: ['s5'] },
  ]).accepted, true);
  assert.equal(validateDomainResult(task, [
    { ...id(1), answer: 'A', sources: ['s1'] },
    { ...id(1), answer: 'A', sources: ['s2'] },
  ]).accepted, false);
});

test('security rejects any critical finding and duplicate operator quorum', () => {
  const task = createDomainTask('security', { target: 'contract' });
  assert.equal(validateDomainResult(task, [
    { ...id(1), severity: 'low', findingsDigest: '1' },
    { ...id(2), severity: 'medium', findingsDigest: '2' },
    { ...id(3), severity: 'high', findingsDigest: '3' },
  ]).accepted, true);
  assert.equal(validateDomainResult(task, [
    { ...id(1), severity: 'critical', findingsDigest: '1' },
    { ...id(2), severity: 'medium', findingsDigest: '2' },
    { ...id(3), severity: 'low', findingsDigest: '3' },
  ]).accepted, false);
  assert.equal(validateDomainResult(task, [
    { ...id(1), severity: 'low', findingsDigest: '1' },
    { operatorId: 'operator-1', providerId: 'provider-4', severity: 'low', findingsDigest: '4' },
    { ...id(2), severity: 'low', findingsDigest: '2' },
  ]).accepted, false);
});

test('infrastructure requires two-thirds healthy quorum', () => {
  const task = createDomainTask('infrastructure', { service: 'api' });
  assert.equal(validateDomainResult(task, [
    { ...id(1), healthy: true, latencyMs: 10 },
    { ...id(2), healthy: true, latencyMs: 20 },
    { ...id(3), healthy: false, latencyMs: 100 },
  ]).accepted, true);
  assert.equal(validateDomainResult(task, [
    { ...id(1), healthy: true, latencyMs: 10 },
    { ...id(2), healthy: false, latencyMs: 100 },
    { ...id(3), healthy: false, latencyMs: 100 },
  ]).accepted, false);
});

test('defi requires no denial and median risk below policy', () => {
  const task = createDomainTask('defi', { action: 'swap' });
  assert.equal(validateDomainResult(task, [
    { ...id(1), decision: 'allow', riskScore: 10 },
    { ...id(2), decision: 'allow', riskScore: 20 },
    { ...id(3), decision: 'allow', riskScore: 30 },
  ]).accepted, true);
  assert.equal(validateDomainResult(task, [
    { ...id(1), decision: 'deny', riskScore: 10 },
    { ...id(2), decision: 'allow', riskScore: 20 },
    { ...id(3), decision: 'allow', riskScore: 30 },
  ]).accepted, false);
});

test('automation binds approval to exact policy version', () => {
  const task = createDomainTask('automation', { action: 'deploy', policyVersion: 'v1' });
  assert.equal(validateDomainResult(task, [
    { ...id(1), approved: true, policyVersion: 'v1' },
    { ...id(2), approved: true, policyVersion: 'v1' },
    { ...id(3), approved: false, policyVersion: 'v1' },
  ]).accepted, true);
  assert.equal(validateDomainResult(task, [
    { ...id(1), approved: true, policyVersion: 'v1' },
    { ...id(2), approved: true, policyVersion: 'evil' },
    { ...id(3), approved: true, policyVersion: 'v1' },
  ]).accepted, false);
});

test('domain evidence is bound to task and result digests', () => {
  const task = createDomainTask('infrastructure', { service: 'api' });
  const result = validateDomainResult(task, [
    { ...id(1), healthy: true, latencyMs: 10 },
    { ...id(2), healthy: true, latencyMs: 20 },
    { ...id(3), healthy: true, latencyMs: 30 },
  ]);
  const evidence = buildTaskEvidence(task, result);
  assert.match(evidence.taskDigest, /^[a-f0-9]{64}$/);
  assert.match(evidence.resultDigest, /^[a-f0-9]{64}$/);
});
