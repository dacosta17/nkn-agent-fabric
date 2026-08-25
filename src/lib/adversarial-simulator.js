import { createHash } from 'node:crypto';
import { stableJson } from './canonical.js';

export function buildScenario({ honestOperators = 3, maliciousOperators = 0, sybilIdentitiesPerOperator = 1, colluding = true, quorum = 2 }) {
  if (!Number.isInteger(honestOperators) || honestOperators < 0) throw new Error('honestOperators must be a non-negative integer');
  if (!Number.isInteger(maliciousOperators) || maliciousOperators < 0) throw new Error('maliciousOperators must be a non-negative integer');
  if (!Number.isInteger(sybilIdentitiesPerOperator) || sybilIdentitiesPerOperator < 1) throw new Error('sybilIdentitiesPerOperator must be positive');
  if (!Number.isInteger(quorum) || quorum < 1) throw new Error('quorum must be positive');

  const operators = [];
  for (let i = 0; i < honestOperators; i += 1) operators.push({ operatorId: `honest-${i + 1}`, honest: true, identities: 1 });
  for (let i = 0; i < maliciousOperators; i += 1) operators.push({ operatorId: `malicious-${i + 1}`, honest: false, identities: sybilIdentitiesPerOperator });
  return { version: 1, type: 'adversarial-scenario.v1', quorum, colluding, operators };
}

function observationsForScenario(scenario) {
  const observations = [];
  for (const operator of scenario.operators) {
    for (let i = 0; i < operator.identities; i += 1) {
      observations.push({
        operatorId: operator.operatorId,
        identityId: `${operator.operatorId}-identity-${i + 1}`,
        value: operator.honest ? 'honest' : (scenario.colluding ? 'malicious' : `malicious-${i + 1}`),
        honest: operator.honest,
      });
    }
  }
  return observations;
}

export function simulateScenario(scenario) {
  const observations = observationsForScenario(scenario);
  const honest = observations.filter((item) => item.honest);
  const malicious = observations.filter((item) => !item.honest);
  const byValue = new Map();
  for (const observation of observations) {
    if (!byValue.has(observation.value)) byValue.set(observation.value, []);
    byValue.get(observation.value).push(observation);
  }

  const winning = [...byValue.entries()].sort((a, b) => b[1].length - a[1].length)[0];
  const safetyViolation = Boolean(winning && winning[0] === 'malicious' && winning[1].length >= scenario.quorum);
  const livenessFailure = honest.length < scenario.quorum;
  const distinctHonestOperators = new Set(honest.map((item) => item.operatorId)).size;
  const distinctMaliciousOperators = new Set(malicious.map((item) => item.operatorId)).size;

  return {
    scenario,
    observations,
    metrics: {
      totalIdentities: observations.length,
      distinctOperators: new Set(observations.map((item) => item.operatorId)).size,
      honestIdentities: honest.length,
      maliciousIdentities: malicious.length,
      distinctHonestOperators,
      distinctMaliciousOperators,
      quorum: scenario.quorum,
      safetyViolation,
      livenessFailure,
      safe: !safetyViolation,
      live: !livenessFailure,
    },
  };
}

export function runAttackMatrix({ maxHonestOperators = 5, maxMaliciousOperators = 5, sybilFactors = [1, 2, 5], quorum = 2 } = {}) {
  const results = [];
  for (let honest = 1; honest <= maxHonestOperators; honest += 1) {
    for (let malicious = 0; malicious <= maxMaliciousOperators; malicious += 1) {
      for (const sybilIdentitiesPerOperator of sybilFactors) {
        const scenario = buildScenario({ honestOperators: honest, maliciousOperators: malicious, sybilIdentitiesPerOperator, quorum });
        results.push(simulateScenario(scenario));
      }
    }
  }
  return results;
}

export function matrixDigest(results) {
  return createHash('sha256').update(stableJson(results)).digest('hex');
}
