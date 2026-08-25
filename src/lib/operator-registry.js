import { createHash, sign, verify } from 'node:crypto';
import { stableJson, digest } from './canonical.js';

const b64 = (value) => Buffer.from(value).toString('base64');
const fromB64 = (value) => Buffer.from(value, 'base64');

export function operatorRecordUnsigned({ operatorId, publicKey, nknAddresses = [], capabilities = [], createdAt, expiresAt, nonce }) {
  if (!operatorId || !publicKey || !createdAt || !expiresAt || !nonce) throw new Error('operator record fields are required');
  return {
    version: 1,
    type: 'operator-record.v1',
    operatorId,
    publicKey,
    nknAddresses: [...new Set(nknAddresses)].sort(),
    capabilities: [...new Set(capabilities)].sort(),
    createdAt,
    expiresAt,
    nonce,
  };
}

export function signOperatorRecord({ identity, operatorId, nknAddresses = [], capabilities = [], createdAt = Date.now(), expiresAt, nonce = digest(`${operatorId}:${createdAt}`) }) {
  if (!expiresAt || expiresAt <= createdAt) throw new Error('expiresAt must be after createdAt');
  const unsigned = operatorRecordUnsigned({ operatorId, publicKey: identity.publicKeyB64, nknAddresses, capabilities, createdAt, expiresAt, nonce });
  const signature = sign(null, Buffer.from(stableJson(unsigned)), identity.privateKey);
  return { ...unsigned, signature: b64(signature), recordDigest: digest(unsigned) };
}

export function verifyOperatorRecord(record, { now = Date.now(), expectedNknAddress } = {}) {
  if (!record || record.type !== 'operator-record.v1') return { valid: false, reason: 'invalid-record-type' };
  if (!Number.isFinite(record.createdAt) || !Number.isFinite(record.expiresAt) || now < record.createdAt || now > record.expiresAt) return { valid: false, reason: 'record-expired-or-not-yet-valid' };
  if (!record.operatorId || !record.publicKey || !record.signature) return { valid: false, reason: 'missing-record-fields' };
  if (expectedNknAddress && !record.nknAddresses.includes(expectedNknAddress)) return { valid: false, reason: 'nkn-address-not-bound' };
  const { signature, recordDigest, ...unsigned } = record;
  if (recordDigest !== digest(unsigned)) return { valid: false, reason: 'record-digest-mismatch' };
  try {
    const key = fromB64(record.publicKey);
    const valid = verify(null, Buffer.from(stableJson(unsigned)), { key, format: 'der', type: 'spki' }, fromB64(signature));
    return valid ? { valid: true, recordDigest } : { valid: false, reason: 'invalid-record-signature' };
  } catch { return { valid: false, reason: 'record-verification-error' }; }
}

export function createRegistry(records = []) {
  const byOperator = new Map();
  for (const record of records) {
    const verified = verifyOperatorRecord(record);
    if (!verified.valid) throw new Error(`invalid operator record: ${verified.reason}`);
    if (byOperator.has(record.operatorId)) throw new Error(`duplicate operator: ${record.operatorId}`);
    byOperator.set(record.operatorId, record);
  }
  return {
    version: 1,
    type: 'operator-registry.v1',
    records: [...byOperator.values()].sort((a, b) => a.operatorId.localeCompare(b.operatorId)),
    registryDigest: digest([...byOperator.values()].sort((a, b) => a.operatorId.localeCompare(b.operatorId))),
  };
}

export function verifyOperatorMembership({ registry, operatorId, nknAddress, now = Date.now() }) {
  if (!registry || registry.type !== 'operator-registry.v1') return { valid: false, reason: 'invalid-registry-type' };
  const record = registry.records?.find((item) => item.operatorId === operatorId);
  if (!record) return { valid: false, reason: 'operator-not-registered' };
  const verified = verifyOperatorRecord(record, { now, expectedNknAddress: nknAddress });
  return verified.valid ? { valid: true, recordDigest: verified.recordDigest } : verified;
}

export function registryFingerprint(registry) {
  return createHash('sha256').update(stableJson(registry)).digest('hex');
}
