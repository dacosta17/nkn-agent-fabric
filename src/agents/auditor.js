import { digest, stableJson } from '../lib/canonical.js';
import { validateObservation } from '../lib/tasks.js';

function unique(values) { return new Set(values).size === values.length; }

export function auditQuorum({ requestId, responses, elapsedMs, expectedPeers = [], minDistinctOperators = 2, minDistinctProviders = 2, minDistinctSourceGroups = 2 }) {
  const peerIds = responses.map(({ peer }) => peer).sort();
  const requiredPeers = [...expectedPeers].sort();
  if (requiredPeers.length && (peerIds.length !== requiredPeers.length || peerIds.some((peer, i) => peer !== requiredPeers[i]))) {
    throw new Error('peer-set mismatch: coordinator cannot redefine the verification participant set');
  }
  if (!unique(peerIds)) throw new Error('duplicate peer response');

  const observations = responses.map(({ peer, value }) => {
    if (value?.error) throw new Error(`worker ${peer} error: ${value.error}`);
    const observation = value?.result;
    validateObservation(observation);
    if (value?.evidence?.digest !== digest(observation)) throw new Error(`evidence digest mismatch from ${peer}`);
    const operatorId = value?.evidence?.operatorId;
    const providerId = value?.evidence?.providerId ?? value?.evidence?.source;
    const sourceGroup = value?.evidence?.sourceGroup ?? value?.evidence?.source;
    if (!operatorId || operatorId === 'unknown') throw new Error(`missing operator identity from ${peer}`);
    if (!providerId) throw new Error(`missing provider identity from ${peer}`);
    if (!sourceGroup) throw new Error(`missing source group from ${peer}`);
    return { peer, observation, evidence: { ...value.evidence, operatorId, providerId, sourceGroup } };
  });

  const operators = observations.map((x) => x.evidence.operatorId);
  const providers = observations.map((x) => x.evidence.providerId);
  const sourceGroups = observations.map((x) => x.evidence.sourceGroup);
  const diversity = {
    distinctOperators: new Set(operators).size,
    distinctProviders: new Set(providers).size,
    distinctSourceGroups: new Set(sourceGroups).size,
  };
  const diversitySatisfied = diversity.distinctOperators >= minDistinctOperators
    && diversity.distinctProviders >= minDistinctProviders
    && diversity.distinctSourceGroups >= minDistinctSourceGroups;

  const prices = observations.map((x) => x.observation.price);
  const min = Math.min(...prices); const max = Math.max(...prices);
  const relativeSpread = min === 0 ? Infinity : (max - min) / min;
  const quorum = observations.length >= 2 && diversitySatisfied && relativeSpread <= 0.05;
  const result = {
    version: 1,
    type: 'verification-result.v1',
    requestId,
    quorum,
    observationCount: observations.length,
    requiredPeers: requiredPeers.length ? requiredPeers : peerIds,
    diversity,
    relativeSpread,
    elapsedMs: Number(elapsedMs.toFixed(2)),
    observations,
  };
  return { ...result, resultDigest: digest(result), canonical: stableJson(result) };
}

export function verifyQuorumResult(bundle, { expectedPeers = [], minDistinctOperators = 2, minDistinctProviders = 2, minDistinctSourceGroups = 2 } = {}) {
  if (!bundle || bundle.type !== 'verification-result.v1') return { valid: false, reason: 'invalid-verification-result-type' };
  if (bundle.resultDigest !== digest({
    version: bundle.version,
    type: bundle.type,
    requestId: bundle.requestId,
    quorum: bundle.quorum,
    observationCount: bundle.observationCount,
    requiredPeers: bundle.requiredPeers,
    diversity: bundle.diversity,
    relativeSpread: bundle.relativeSpread,
    elapsedMs: bundle.elapsedMs,
    observations: bundle.observations,
  })) return { valid: false, reason: 'result-digest-mismatch' };
  const required = [...expectedPeers].sort();
  const actual = [...(bundle.requiredPeers ?? [])].sort();
  if (required.length && (required.length !== actual.length || required.some((peer, i) => peer !== actual[i]))) return { valid: false, reason: 'expected-peer-set-mismatch' };
  if (bundle.diversity.distinctOperators < minDistinctOperators || bundle.diversity.distinctProviders < minDistinctProviders || bundle.diversity.distinctSourceGroups < minDistinctSourceGroups) {
    return { valid: false, reason: 'insufficient-diversity' };
  }
  return { valid: true };
}
