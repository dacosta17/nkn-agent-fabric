import assert from 'node:assert/strict';
import { createDomainTask, validateDomainResult, buildTaskEvidence, listDomainCapabilities } from '../domains/verifiable-domains.js';

const obs = (n, payload) => ({ operatorId: `operator-${n}`, providerId: `provider-${n}`, ...payload });

const scenarios = {
  intelligence: {
    task: { question: 'Is the NKN network activity elevated?' },
    observations: [
      obs(1, { answer: 'yes', sources: ['rpc', 'market'] }),
      obs(2, { answer: 'yes', sources: ['news', 'network'] }),
      obs(3, { answer: 'no', sources: ['social', 'community'] }),
    ],
  },
  security: {
    task: { target: 'example-contract' },
    observations: [
      obs(1, { severity: 'low', findingsDigest: 'a' }),
      obs(2, { severity: 'medium', findingsDigest: 'b' }),
      obs(3, { severity: 'medium', findingsDigest: 'c' }),
      obs(4, { severity: 'high', findingsDigest: 'd' }),
    ],
  },
  infrastructure: {
    task: { service: 'nkn-gateway-eu' },
    observations: [
      obs(1, { healthy: true, latencyMs: 82 }),
      obs(2, { healthy: true, latencyMs: 95 }),
      obs(3, { healthy: true, latencyMs: 101 }),
      obs(4, { healthy: false, latencyMs: 800 }),
    ],
  },
  defi: {
    task: { action: 'execute_swap' },
    observations: [
      obs(1, { decision: 'allow', riskScore: 22 }),
      obs(2, { decision: 'allow', riskScore: 26 }),
      obs(3, { decision: 'allow', riskScore: 31 }),
      obs(4, { decision: 'allow', riskScore: 28 }),
    ],
  },
  automation: {
    task: { action: 'deploy_release', policyVersion: '2026-08-v1' },
    observations: [
      obs(1, { approved: true, policyVersion: '2026-08-v1' }),
      obs(2, { approved: true, policyVersion: '2026-08-v1' }),
      obs(3, { approved: false, policyVersion: '2026-08-v1' }),
      obs(4, { approved: true, policyVersion: '2026-08-v1' }),
    ],
  },
};

function runScenario(domain) {
  const scenario = scenarios[domain];
  const task = createDomainTask(domain, scenario.task);
  const result = validateDomainResult(task, scenario.observations);
  assert.equal(result.accepted, true, `${domain} scenario should pass`);
  const evidence = buildTaskEvidence(task, result);
  assert.equal(evidence.deterministic, true);
  assert.equal(evidence.validator, `verifiable-${domain}.v1`);
  return { domain, result, evidence };
}

const reports = Object.keys(scenarios).map(runScenario);

const negativeCases = {
  intelligence: () => {
    const task = createDomainTask('intelligence', { question: 'Q' });
    return validateDomainResult(task, [
      obs(1, { answer: 'fabricated', sources: ['one'] }),
      obs(2, { answer: 'yes', sources: ['two', 'three'] }),
      obs(3, { answer: 'no', sources: ['four', 'five'] }),
    ]).accepted;
  },
  security: () => {
    const task = createDomainTask('security', { target: 'contract' });
    return validateDomainResult(task, [
      obs(1, { severity: 'critical', findingsDigest: 'evil' }),
      obs(2, { severity: 'low', findingsDigest: 'a' }),
      obs(3, { severity: 'medium', findingsDigest: 'b' }),
    ]).accepted;
  },
  infrastructure: () => {
    const task = createDomainTask('infrastructure', { service: 'api' });
    return validateDomainResult(task, [
      obs(1, { healthy: true, latencyMs: 10 }),
      obs(2, { healthy: false, latencyMs: 200 }),
      obs(3, { healthy: false, latencyMs: 300 }),
    ]).accepted;
  },
  defi: () => {
    const task = createDomainTask('defi', { action: 'swap' });
    return validateDomainResult(task, [
      obs(1, { decision: 'deny', riskScore: 10 }),
      obs(2, { decision: 'allow', riskScore: 20 }),
      obs(3, { decision: 'allow', riskScore: 30 }),
    ]).accepted;
  },
  automation: () => {
    const task = createDomainTask('automation', { action: 'deploy', policyVersion: 'v1' });
    return validateDomainResult(task, [
      obs(1, { approved: true, policyVersion: 'v1' }),
      obs(2, { approved: true, policyVersion: 'evil' }),
      obs(3, { approved: true, policyVersion: 'v1' }),
    ]).accepted;
  },
  sybil: () => {
    const task = createDomainTask('infrastructure', { service: 'api' });
    return validateDomainResult(task, [
      { operatorId: 'same', providerId: 'p1', healthy: true, latencyMs: 10 },
      { operatorId: 'same', providerId: 'p2', healthy: true, latencyMs: 20 },
      { operatorId: 'same', providerId: 'p3', healthy: true, latencyMs: 30 },
    ]).accepted;
  },
};

for (const [domain, runNegative] of Object.entries(negativeCases)) {
  assert.equal(runNegative(), false, `${domain} adversarial case must be rejected`);
}

console.log(JSON.stringify({
  phase: 'verifiable-domain-matrix',
  capabilities: listDomainCapabilities(),
  reports,
  negativeCases: Object.fromEntries(Object.keys(negativeCases).map((domain) => [domain, 'rejected'])),
  status: 'pass',
}, null, 2));
