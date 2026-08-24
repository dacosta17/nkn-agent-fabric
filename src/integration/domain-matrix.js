import assert from 'node:assert/strict';
import { createDomainTask, validateDomainResult, buildTaskEvidence, listDomainCapabilities } from '../domains/verifiable-domains.js';

const scenarios = {
  intelligence: {
    task: { question: 'Is the NKN network activity elevated?', },
    observations: [
      { answer: 'yes', sources: ['rpc', 'market'] },
      { answer: 'yes', sources: ['news', 'network'] },
      { answer: 'no', sources: ['social', 'market'] },
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
      { decision: 'deny', riskScore: 90 },
    ],
  },
  automation: {
    task: { action: 'deploy_release', policyVersion: '2026-08-v1' },
    observations: [
      { approved: true, policyVersion: '2026-08-v1' },
      { approved: true, policyVersion: '2026-08-v1' },
      { approved: false, policyVersion: '2026-08-v1' },
      { approved: true, policyVersion: '2025-12-v3' },
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

for (const domain of Object.keys(scenarios)) {
  const scenario = scenarios[domain];
  const task = createDomainTask(domain, scenario.task);
  const adversarial = scenario.observations.map((o, index) => index === 0
    ? ({ ...o, policyVersion: domain === 'automation' ? 'evil' : o.policyVersion })
    : o);
  if (domain === 'intelligence') adversarial[0] = { answer: 'fabricated', sources: ['one'] };
  const result = validateDomainResult(task, adversarial);
  if (domain === 'intelligence') assert.equal(result.accepted, false, 'intelligence must reject weak fabricated evidence');
  if (domain === 'automation') assert.equal(result.accepted, false, 'automation must reject policy mismatch');
}

console.log(JSON.stringify({
  phase: 'verifiable-domain-matrix',
  capabilities: listDomainCapabilities(),
  reports,
  status: 'pass',
}, null, 2));
