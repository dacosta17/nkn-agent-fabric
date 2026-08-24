import { createHash } from 'node:crypto';

export function makeObservationTask({ symbol = 'NKNUSDT', requestId }) {
  return {
    id: requestId,
    type: 'market-observation.v1',
    symbol,
    createdAt: Date.now(),
    nonce: createHash('sha256').update(`${requestId}:${Date.now()}`).digest('hex').slice(0, 16),
  };
}

export function validateObservation(result) {
  if (!result || typeof result.price !== 'number' || !Number.isFinite(result.price) || result.price <= 0) throw new Error('invalid price');
  if (!Number.isInteger(result.timestamp) || result.timestamp <= 0) throw new Error('invalid timestamp');
  if (!result.source) throw new Error('missing source');
  return true;
}
