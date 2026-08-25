import { digest, stableJson } from '../lib/canonical.js';
import { validateObservation } from '../lib/tasks.js';
import { assessIndependence } from '../lib/independence-policy.js';

function unique(values) { return new Set(values).size === values.length; }

export function auditQuorum({ requestId, responses, elapsedMs, expectedPeers = [], minDistinctOperators = 2, minDistinctProviders = 2, minDistinctSourceGroups = 2, trustedOperatorIds = null }) {
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

  const independence = assessIndependence(observations, {
    minDistinctOperators,
    minDistinctProviders,
    minDistinctSourceGroups,
    trustedOperatorIds,
  });

  const relativeSpread = calculateRelativeSpread(observations);
  const quorum = observations.length >= 2 && independence.independent && relativeSpread <= 0.05;
  const result = {
    version: 1,
    type: 'verification-result.v1',
    requestId,
    quorum,
    observationCount: observations.length,
    requiredPeers: requiredPeers.length ? requiredPeers : peerIds,
    diversity: independence.diversity,
    independence,
    relativeSpread,
    elapsedMs: Number(elapsedMs.toFixed(2)),
    observations,
  };
  return { ...result, resultDigest: digest(result), canonical: stableJson(result) };
}

function calculateRelativeSpread(observations) {
  const prices = observations.map((x) => x.observation.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === 0 ? Infinity : (max - min) / min;
}

export function verifyQuorumResult(bundle, { expectedPeers = [], minDistinctOperators = 2, minDistinctProviders = 2, minDistinctSourceGroups = 2, trustedOperatorIds = null } = {}) {
  if (!bundle || bundle.type !== 'verification-result.v1') return { valid: false, reason: 'invalid-verification-result-type' };
  if (!Array.isArray(bundle.observations) || bundle.observationCount !== bundle.observations.length) return { valid: false, reason: 'observation-count-mismatch' };
  const unsigned = {
    version: bundle.version,
    type: bundle.type,
    requestId: bundle.requestId,
    quorum: bundle.quorum,
    observationCount: bundle.observationCount,
    requiredPeers: bundle.requiredPeers,
    diversity: bundle.diversity,
    independence: bundle.independence,
    relativeSpread: bundle.relativeSpread,
    elapsedMs: bundle.elapsedMs,
    observations: bundle.observations,
  };
  if (bundle.resultDigest !== digest(unsigned)) return { valid: false, reason: 'result-digest-mismatch' };
  const required = [...expectedPeers].sort();
  const actual = [...(bundle.requiredPeers ?? [])].sort();
  if (required.length && (required.length !== actual.length || required.some((peer, i) => peer !== actual[i]))) return { valid: false, reason: 'expected-peer-set-mismatch' };

  for (const item of bundle.observations) {
    try { validateObservation(item.observation); } catch { return { valid: false, reason: 'invalid-observation' }; }
    if (item.evidence?.digest !== digest(item.observation)) return { valid: false, reason: 'evidence-digest-mismatch' };
  }

  const independence = assessIndependence(bundle.observations, {
    minDistinctOperators,
    minDistinctProviders,
    minDistinctSourceGroups,
    trustedOperatorIds,
  });
  if (!independence.independent) return { valid: false, reason: independence.reason };
  if (bundle.diversity.distinctOperators !== independence.diversity.distinctOperators
    || bundle.diversity.distinctProviders !== independence.diversity.distinctProviders
    || bundle.diversity.distinctSourceGroups !== independence.diversity.distinctSourceGroups) {
    return { valid: false, reason: 'diversity-metadata-mismatch' };
  }
  if (bundle.independence?.reason !== independence.reason) return { valid: false, reason: 'independence-metadata-mismatch' };

  const relativeSpread = calculateRelativeSpread(bundle.observations);
  if (bundle.relativeSpread !== relativeSpread) return { valid: false, reason: 'spread-metadata-mismatch' };
  const expectedQuorum = bundle.observations.length >= 2 && independence.independent && relativeSpread <= 0.05;
  if (bundle.quorum !== expectedQuorum) return { valid: false, reason: 'quorum-decision-mismatch' };
  return { valid: true };
}
