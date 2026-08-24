import { makeEnvelope, safeJsonParse, assertFresh } from './protocol.js';

export function createRequest({ requestId, sender, recipient, task }) {
  return makeEnvelope({ kind: 'request', requestId, sender, recipient, payload: { task } });
}

export function createResponse({ requestId, sender, recipient, result, evidence }) {
  return makeEnvelope({ kind: 'response', requestId, sender, recipient, payload: { result, evidence } });
}

export function parseEnvelope(raw) {
  const envelope = safeJsonParse(raw);
  assertFresh(envelope);
  return envelope;
}

export class BoundedTtlSet {
  constructor({ max = 5000, ttlMs = 5 * 60_000 } = {}) { this.max = max; this.ttlMs = ttlMs; this.items = new Map(); }
  has(key) { this.gc(); return this.items.has(key); }
  add(key) { this.gc(); this.items.set(key, Date.now() + this.ttlMs); if (this.items.size > this.max) this.items.delete(this.items.keys().next().value); }
  gc() { const now = Date.now(); for (const [k, expiry] of this.items) if (expiry <= now) this.items.delete(k); }
}
