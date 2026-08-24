import test from 'node:test';
import assert from 'node:assert/strict';
import { createDomainTask, validateDomainResult, buildTaskEvidence } from '../src/domains/verifiable-domains.js';

test('intelligence requires independent evidence quorum', () => {
  const task = createDomainTask('intelligence', { question: 'Q' });
  assert.equal(validateDomainResult(task, [
    { answer: 'A', sources: ['s1', 's2'] },
    { answer: 'A', sources: ['s3', 's4'] },
    { answer: 'B', sources: ['s5'] },
  ]).accepted, true);
  assert.equal(validateDomainResult(task, [
    { answer: 'A', sources: ['s1'] },
    { answer: 'B', sources: ['s2'] },
  ]).accepted, false);
});

test('security rejects any critical finding', () => {
  const task = createDomainTask('security', { target: 'contract' });
  assert.equal(validateDomainResult(task, [
    { severity: 'low', findingsDigest: '1' },
    { severity: 'medium', findingsDigest: '2' },
    { severity: 'high', findingsDigest: '3' },
  ]).accepted, true);
  assert.equal(validateDomainResult(task, [
    { severity: 'critical', findingsDigest: '1' },
    { severity: 'medium', findingsDigest: '2' },
    { severity: 'low', findingsDigest: '3' },
  ]).accepted, false);
});

test('infrastructure requires two-thirds healthy quorum', () => {
  const task = createDomainTask('infrastructure', { service: 'api' });
  assert.equal(validateDomainResult(task, [
    { healthy: true, latencyMs: 10 },
    { healthy: true, latencyMs: 20 },
    { healthy: false, latencyMs: 100 },
  ]).accepted, true);
  assert.equal(validateDomainResult(task, [
    { healthy: true, latencyMs: 10 },
    { healthy: false, latencyMs: 100 },
    { healthy: false, latencyMs: 100 },
  ]).accepted, false);
});

test('defi requires no denial and median risk below policy', () => {
  const task = createDomainTask('defi', { action: 'swap' });
  assert.equal(validateDomainResult(task, [
    { decision: 'allow', riskScore: 10 },
    { decision: 'allow', riskScore: 20 },
    { decision: 'allow', riskScore: 30 },
  ]).accepted, true);
  assert.equal(validateDomainResult(task, [
    { decision: 'deny', riskScore: 10 },
    { decision: 'allow', riskScore: 20 },
    { decision: 'allow', riskScore: 30 },
  ]).accepted, false);
});

test('automation binds approval to exact policy version', () => {
  const task = createDomainTask('automation', { action: 'deploy', policyVersion: 'v1' });
  assert.equal(validateDomainResult(task, [
    { approved: true, policyVersion: 'v1' },
    { approved: true, policyVersion: 'v1' },
    { approved: false, policyVersion: 'v1' },
  ]).accepted, true);
  assert.equal(validateDomainResult(task, [
    { approved: true, policyVersion: 'v1' },
    { approved: true, policyVersion: 'evil' },
    { approved: true, policyVersion: 'v1' },
  ]).accepted, false);
});

test('domain evidence is bound to task and result digests', () => {
  const task = createDomainTask('infrastructure', { service: 'api' });
  const result = validateDomainResult(task, [
    { healthy: true, latencyMs: 10 },
    { healthy: true, latencyMs: 20 },
    { healthy: true, latencyMs: 30 },
  ]);
  const evidence = buildTaskEvidence(task, result);
  assert.match(evidence.taskDigest, /^[a-f0-9]{64}$/);
  assert.match(evidence.resultDigest, /^[a-f0-9]{64}$/);
});
