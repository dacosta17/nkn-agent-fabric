import { digest } from '../lib/canonical.js';
import { validateObservation } from '../lib/tasks.js';

export function auditQuorum({ requestId, responses, elapsedMs }) {
  const observations = responses.map(({ peer, value }) => {
    if (value?.error) throw new Error(`worker ${peer} error: ${value.error}`);
    const observation = value?.result;
    validateObservation(observation);
    if (value?.evidence?.digest !== digest(observation)) throw new Error(`evidence digest mismatch from ${peer}`);
    return { peer, observation, evidence: value.evidence };
  });
  const prices = observations.map((x) => x.observation.price);
  const min = Math.min(...prices); const max = Math.max(...prices);
  const relativeSpread = min === 0 ? Infinity : (max - min) / min;
  const quorum = observations.length >= 2 && relativeSpread <= 0.05;
  return {
    requestId,
    quorum,
    observationCount: observations.length,
    relativeSpread,
    elapsedMs: Number(elapsedMs.toFixed(2)),
    observations,
  };
}
