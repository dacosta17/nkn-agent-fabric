import { digest } from '../lib/canonical.js';

const DOMAIN_NAMES = Object.freeze([
  'intelligence',
  'security',
  'infrastructure',
  'defi',
  'automation',
]);

const severityRank = Object.freeze({ info: 0, low: 1, medium: 2, high: 3, critical: 4 });

function requireString(value, name) {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${name} must be a non-empty string`);
}

function requireFiniteNumber(value, name) {
  if (!Number.isFinite(value)) throw new Error(`${name} must be finite`);
}

function independentEvidence(observations, minimum) {
  const valid = observations.filter((o) => (
    typeof o?.operatorId === 'string' &&
    typeof o?.providerId === 'string' &&
    o.operatorId.length > 0 &&
    o.providerId.length > 0
  ));
  if (valid.length < minimum) return { accepted: false, valid: [], operatorCount: 0, providerCount: 0, reason: 'insufficient-independent-observations' };

  const operators = new Set(valid.map((o) => o.operatorId));
  const providers = new Set(valid.map((o) => o.providerId));
  if (operators.size < minimum) return { accepted: false, valid, operatorCount: operators.size, providerCount: providers.size, reason: 'insufficient-operator-diversity' };
  if (providers.size < minimum) return { accepted: false, valid, operatorCount: operators.size, providerCount: providers.size, reason: 'insufficient-provider-diversity' };

  const deduped = [];
  const seen = new Set();
  for (const item of valid) {
    const key = `${item.operatorId}:${item.providerId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }
  if (deduped.length < minimum) return { accepted: false, valid: deduped, operatorCount: operators.size, providerCount: providers.size, reason: 'duplicate-provider-identity' };
  return { accepted: true, valid: deduped, operatorCount: operators.size, providerCount: providers.size };
}

export function listDomainCapabilities() {
  return DOMAIN_NAMES.map((domain) => domainCapability(domain));
}

export function domainCapability(domain) {
  if (!DOMAIN_NAMES.includes(domain)) throw new Error(`unsupported domain: ${domain}`);
  return {
    version: 1,
    domain,
    capability: `verifiable-${domain}.v1`,
    requiresIndependentProviders: true,
    requiresIndependentOperators: true,
    deterministicValidation: true,
  };
}

export function createDomainTask(domain, input = {}) {
  if (!DOMAIN_NAMES.includes(domain)) throw new Error(`unsupported domain: ${domain}`);
  const task = { version: 1, type: `verifiable-${domain}.v1`, domain, input };

  switch (domain) {
    case 'intelligence':
      requireString(input.question, 'question');
      break;
    case 'security':
      requireString(input.target, 'target');
      break;
    case 'infrastructure':
      requireString(input.service, 'service');
      break;
    case 'defi':
      requireString(input.action, 'action');
      break;
    case 'automation':
      requireString(input.action, 'action');
      requireString(input.policyVersion, 'policyVersion');
      break;
    default:
      throw new Error(`unsupported domain: ${domain}`);
  }

  return task;
}

function validateIntelligence(observations) {
  const independent = independentEvidence(observations, 2);
  if (!independent.accepted) return independent;
  const valid = independent.valid.filter((o) => typeof o.answer === 'string' && Array.isArray(o.sources) && o.sources.length >= 2);
  if (valid.length < 2) return { accepted: false, reason: 'insufficient-evidence', operatorCount: independent.operatorCount, providerCount: independent.providerCount };
  const answers = new Map();
  for (const o of valid) answers.set(o.answer, (answers.get(o.answer) ?? 0) + 1);
  const [answer, count] = [...answers.entries()].sort((a, b) => b[1] - a[1])[0];
  return {
    accepted: count >= 2,
    confidence: count / valid.length,
    answer,
    providers: valid.length,
    operatorCount: independent.operatorCount,
    providerCount: independent.providerCount,
    reason: count >= 2 ? 'quorum' : 'no-answer-quorum',
  };
}

function validateSecurity(observations) {
  const independent = independentEvidence(observations, 3);
  if (!independent.accepted) return independent;
  const valid = independent.valid.filter((o) => severityRank[o.severity] !== undefined && typeof o.findingsDigest === 'string');
  if (valid.length < 3) return { accepted: false, reason: 'invalid-security-observation', operatorCount: independent.operatorCount, providerCount: independent.providerCount };
  const critical = valid.filter((o) => o.severity === 'critical').length;
  const highOrWorse = valid.filter((o) => severityRank[o.severity] >= severityRank.high).length;
  return {
    accepted: critical === 0,
    maxSeverity: valid.reduce((max, o) => severityRank[o.severity] > severityRank[max] ? o.severity : max, 'info'),
    highOrWorseCount: highOrWorse,
    providerCount: valid.length,
    operatorCount: independent.operatorCount,
    reason: critical > 0 ? 'critical-finding' : 'no-critical-finding',
  };
}

function validateInfrastructure(observations) {
  const independent = independentEvidence(observations, 3);
  if (!independent.accepted) return independent;
  const valid = independent.valid.filter((o) => typeof o.healthy === 'boolean' && Number.isFinite(o.latencyMs));
  if (valid.length < 3) return { accepted: false, reason: 'invalid-health-observation', operatorCount: independent.operatorCount, providerCount: independent.providerCount };
  const healthy = valid.filter((o) => o.healthy).length;
  const medianLatency = [...valid].map((o) => o.latencyMs).sort((a, b) => a - b)[Math.floor(valid.length / 2)];
  return {
    accepted: healthy >= Math.ceil(valid.length * 2 / 3),
    healthyProviders: healthy,
    providerCount: valid.length,
    operatorCount: independent.operatorCount,
    medianLatencyMs: medianLatency,
    reason: healthy >= Math.ceil(valid.length * 2 / 3) ? 'availability-quorum' : 'availability-failure',
  };
}

function validateDefi(observations) {
  const independent = independentEvidence(observations, 3);
  if (!independent.accepted) return independent;
  const valid = independent.valid.filter((o) => ['allow', 'deny'].includes(o.decision) && Number.isFinite(o.riskScore));
  if (valid.length < 3) return { accepted: false, reason: 'invalid-risk-observation', operatorCount: independent.operatorCount, providerCount: independent.providerCount };
  const deny = valid.filter((o) => o.decision === 'deny').length;
  const medianRisk = [...valid].map((o) => o.riskScore).sort((a, b) => a - b)[Math.floor(valid.length / 2)];
  return {
    accepted: deny === 0 && medianRisk < 50,
    medianRiskScore: medianRisk,
    denyCount: deny,
    providerCount: valid.length,
    operatorCount: independent.operatorCount,
    reason: deny > 0 ? 'provider-denied-action' : medianRisk >= 50 ? 'risk-above-policy' : 'risk-quorum',
  };
}

function validateAutomation(observations, task) {
  const independent = independentEvidence(observations, 3);
  if (!independent.accepted) return independent;
  const valid = independent.valid.filter((o) => typeof o.approved === 'boolean' && typeof o.policyVersion === 'string');
  if (valid.length < 3) return { accepted: false, reason: 'invalid-approval-observation', operatorCount: independent.operatorCount, providerCount: independent.providerCount };
  const policyMatch = valid.filter((o) => o.policyVersion === task.input.policyVersion);
  const approved = policyMatch.filter((o) => o.approved).length;
  return {
    accepted: policyMatch.length === valid.length && approved >= 2,
    approvedProviders: approved,
    providerCount: valid.length,
    operatorCount: independent.operatorCount,
    policyVersion: task.input.policyVersion,
    reason: policyMatch.length !== valid.length ? 'policy-version-conflict' : approved >= 2 ? 'approval-quorum' : 'approval-denied',
  };
}

export function validateDomainResult(task, observations) {
  if (!Array.isArray(observations)) throw new Error('observations must be an array');
  switch (task.domain) {
    case 'intelligence': return validateIntelligence(observations);
    case 'security': return validateSecurity(observations);
    case 'infrastructure': return validateInfrastructure(observations);
    case 'defi': return validateDefi(observations);
    case 'automation': return validateAutomation(observations, task);
    default: throw new Error(`unsupported domain: ${task.domain}`);
  }
}

export function buildTaskEvidence(task, result) {
  return {
    taskDigest: digest(task),
    resultDigest: digest(result),
    validator: `verifiable-${task.domain}.v1`,
    deterministic: true,
  };
}
