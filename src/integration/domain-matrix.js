import assert from 'node:assert/strict';
import { createDomainTask, validateDomainResult, buildTaskEvidence, listDomainCapabilities } from '../domains/verifiable-domains.js';

const scenarios = {
  intelligence: {
    task: { question: 'Is the NKN network activity elevated?' },
    observations: [
      { answer: 'yes', sources: ['rpc', 'market'] },
      { answer: 'yes', sources: ['news', 'network'] },
      { answer: 'no', sources: ['social', 'community'] },
    ],
  },
  security: {
    task: { target: 'example-contract' },
    observations: [
      { severity: 'low', findingsDigest: 'a' },
      { severity: 'medium', findingsDigest: 'b' },
      { severity: 'medium', findingsDigest: 'c' },
      { severity: 'high', findingsDigest: 'd' },
    ],
  },
  infrastructure: {
    task: { service: 'nkn-gateway-eu' },
    observations: [
      { healthy: true, latencyMs: 82 },
      { healthy: true, latencyMs: 95 },
      { healthy: true, latencyMs: 101 },
      { healthy: false, latencyMs: 800 },
    ],
  },
  defi: {
    task: { action: 'execute_swap' },
    observations: [
      { decision: 'allow', riskScore: 22 },
      { decision: 'allow', riskScore: 26 },
      { decision: 'allow', riskScore: 31 },
      { decision: 'allow', riskScore: 28 },
    ],
  },
  automation: {
    task: { action: 'deploy_release', policyVersion: '2026-08-v1' },
    observations: [
      { approved: true, policyVersion: '2026-08-v1' },
      { approved: true, policyVersion: '2026-08-v1' },
      { approved: false, policyVersion: '2026-08-v1' },
      { approved: true, policyVersion: '2026-08-v1' },
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
      { answer: 'fabricated', sources: ['one'] },
      { answer: 'yes', sources: ['two', 'three'] },
      { answer: 'no', sources: ['four', 'five'] },
    ]).accepted;
  },
  security: () => {
    const task = createDomainTask('security', { target: 'contract' });
    return validateDomainResult(task, [
      { severity: 'critical', findingsDigest: 'evil' },
      { severity: 'low', findingsDigest: 'a' },
      { severity: 'medium', findingsDigest: 'b' },
    ]).accepted;
  },
  infrastructure: () => {
    const task = createDomainTask('infrastructure', { service: 'api' });
    return validateDomainResult(task, [
      { healthy: true, latencyMs: 10 },
      { healthy: false, latencyMs: 200 },
      { healthy: false, latencyMs: 300 },
    ]).accepted;
  },
  defi: () => {
    const task = createDomainTask('defi', { action: 'swap' });
    return validateDomainResult(task, [
      { decision: 'deny', riskScore: 10 },
      { decision: 'allow', riskScore: 20 },
      { decision: 'allow', riskScore: 30 },
    ]).accepted;
  },
  automation: () => {
    const task = createDomainTask('automation', { action: 'deploy', policyVersion: 'v1' });
    return validateDomainResult(task, [
      { approved: true, policyVersion: 'v1' },
      { approved: true, policyVersion: 'evil' },
      { approved: true, policyVersion: 'v1' },
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
