export const PROTOCOL_VERSION = 1;
export const DEFAULT_TTL_MS = 30_000;
export const MAX_PAYLOAD_BYTES = 64 * 1024;

export function makeEnvelope({ kind, requestId, sender, recipient, payload, ttlMs = DEFAULT_TTL_MS }) {
  if (!kind || !requestId || !sender || !recipient) throw new Error('invalid envelope metadata');
  const createdAt = Date.now();
  return { v: PROTOCOL_VERSION, kind, requestId, sender, recipient, createdAt, expiresAt: createdAt + ttlMs, payload };
}

export function assertFresh(envelope, now = Date.now()) {
  if (envelope.v !== PROTOCOL_VERSION) throw new Error('unsupported protocol version');
  if (now > envelope.expiresAt) throw new Error('expired message');
}

export function safeJsonParse(raw) {
  const text = Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw);
  if (Buffer.byteLength(text, 'utf8') > MAX_PAYLOAD_BYTES) throw new Error('payload too large');
  return JSON.parse(text);
}
