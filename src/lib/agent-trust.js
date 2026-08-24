import { generateKeyPairSync, sign, verify, randomUUID } from 'node:crypto';
import { stableJson, digest } from './canonical.js';

const DEFAULT_MANIFEST_TTL_MS = 5 * 60_000;
const DEFAULT_ATTESTATION_TTL_MS = 60_000;

function b64(buffer) { return Buffer.from(buffer).toString('base64'); }
function fromB64(value) { return Buffer.from(value, 'base64'); }

export function createIdentity() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    publicKey,
    privateKey,
    publicKeyB64: b64(publicKey.export({ type: 'spki', format: 'der' })),
  };
}

function unsignedManifest(manifest) {
  const { signature, fingerprint, identityBinding, ...unsigned } = manifest;
  return unsigned;
}

export function createIdentityBindingProof({ nknAddress, identity }) {
  if (!nknAddress) throw new Error('nknAddress is required');
  const binding = {
    version: 1,
    type: 'nkn-identity-binding.v1',
    nknAddress,
    applicationPublicKey: identity.publicKeyB64,
  };
  const signature = sign(null, Buffer.from(stableJson(binding)), identity.privateKey);
  return { ...binding, signature: b64(signature), bindingDigest: digest(binding) };
}

export function verifyIdentityBindingProof(proof, { transportSource } = {}) {
  if (!proof || proof.type !== 'nkn-identity-binding.v1') return { valid: false, reason: 'invalid-binding-type' };
  if (!transportSource) return { valid: false, reason: 'missing-transport-source' };
  if (transportSource !== proof.nknAddress) return { valid: false, reason: 'transport-source-mismatch' };
  try {
    const key = Buffer.from(proof.applicationPublicKey, 'base64');
    const { signature, bindingDigest, ...unsigned } = proof;
    if (bindingDigest !== digest(unsigned)) return { valid: false, reason: 'binding-digest-mismatch' };
    const valid = verify(null, Buffer.from(stableJson(unsigned)), { key, format: 'der', type: 'spki' }, fromB64(signature));
    return valid ? { valid: true } : { valid: false, reason: 'invalid-binding-signature' };
  } catch {
    return { valid: false, reason: 'binding-verification-error' };
  }
}

export function signManifest({ nknAddress, identity, capabilities, endpointClass = 'nkn', ttlMs = DEFAULT_MANIFEST_TTL_MS, identityBinding = createIdentityBindingProof({ nknAddress, identity }) }) {
  if (!nknAddress) throw new Error('nknAddress is required');
  if (identityBinding.nknAddress !== nknAddress || identityBinding.applicationPublicKey !== identity.publicKeyB64) {
    throw new Error('identity binding does not match manifest identity');
  }
  const createdAt = Date.now();
  const manifest = {
    version: 1,
    type: 'agent-capability.v1',
    agentId: nknAddress,
    endpointClass,
    publicKey: identity.publicKeyB64,
    capabilities: [...new Set(capabilities)].sort(),
    createdAt,
    expiresAt: createdAt + ttlMs,
    nonce: randomUUID(),
    identityBinding,
  };
  const signature = sign(null, Buffer.from(stableJson(manifest)), identity.privateKey);
  return { ...manifest, signature: b64(signature), fingerprint: digest(manifest) };
}

export function verifyManifest(manifest, { now = Date.now(), transportSource, requireIdentityBinding = true } = {}) {
  if (!manifest || manifest.type !== 'agent-capability.v1') return { valid: false, reason: 'invalid-manifest-type' };
  if (!Number.isFinite(manifest.expiresAt) || now > manifest.expiresAt) return { valid: false, reason: 'manifest-expired' };
  if (requireIdentityBinding) {
    const binding = verifyIdentityBindingProof(manifest.identityBinding, { transportSource });
    if (!binding.valid) return { valid: false, reason: `identity-binding:${binding.reason}` };
    if (manifest.identityBinding.applicationPublicKey !== manifest.publicKey || manifest.identityBinding.nknAddress !== manifest.agentId) {
      return { valid: false, reason: 'identity-binding-manifest-mismatch' };
    }
  }
  try {
    const publicKey = Buffer.from(manifest.publicKey, 'base64');
    if (!publicKey.length) return { valid: false, reason: 'missing-public-key' };
    const unsigned = unsignedManifest(manifest);
    const valid = verify(null, Buffer.from(stableJson(unsigned)), { key: publicKey, format: 'der', type: 'spki' }, fromB64(manifest.signature));
    if (!valid) return { valid: false, reason: 'invalid-signature' };
    if (manifest.fingerprint !== digest(unsigned)) return { valid: false, reason: 'fingerprint-mismatch' };
    return { valid: true, fingerprint: manifest.fingerprint };
  } catch {
    return { valid: false, reason: 'signature-verification-error' };
  }
}

export function createTaskQuote({ requestId, agentId, capability, price = 0, currency = 'NKN', estimatedMs = 0, identity, ttlMs = DEFAULT_ATTESTATION_TTL_MS }) {
  const createdAt = Date.now();
  const quote = { version: 1, type: 'task-quote.v1', requestId, agentId, capability, price, currency, estimatedMs, createdAt, expiresAt: createdAt + ttlMs, nonce: randomUUID() };
  const signature = sign(null, Buffer.from(stableJson(quote)), identity.privateKey);
  return { ...quote, signature: b64(signature) };
}

export function verifySignedObject(object, identityPublicKeyB64, { now = Date.now() } = {}) {
  if (!object || !object.signature) return { valid: false, reason: 'missing-signature' };
  if (object.expiresAt && now > object.expiresAt) return { valid: false, reason: 'object-expired' };
  const { signature, ...unsigned } = object;
  try {
    const key = Buffer.from(identityPublicKeyB64, 'base64');
    const valid = verify(null, Buffer.from(stableJson(unsigned)), { key, format: 'der', type: 'spki' }, fromB64(signature));
    return valid ? { valid: true } : { valid: false, reason: 'invalid-signature' };
  } catch {
    return { valid: false, reason: 'signature-verification-error' };
  }
}

export function createAttestation({ requestId, agentId, taskDigest, resultDigest, source, providerId = source, operatorId = 'unknown', sourceGroup = source, capturedAt, identity, metadata = {} }) {
  const attestation = { version: 1, type: 'execution-attestation.v1', requestId, agentId, taskDigest, resultDigest, source, providerId, operatorId, sourceGroup, capturedAt, metadata };
  const signature = sign(null, Buffer.from(stableJson(attestation)), identity.privateKey);
  return { ...attestation, signature: b64(signature) };
}

export function verifyAttestation(attestation, manifest, { now = Date.now(), maxAgeMs = DEFAULT_ATTESTATION_TTL_MS, transportSource } = {}) {
  if (!attestation || attestation.type !== 'execution-attestation.v1') return { valid: false, reason: 'invalid-attestation-type' };
  if (Math.abs(now - attestation.capturedAt) > maxAgeMs) return { valid: false, reason: 'attestation-stale' };
  const verifiedManifest = verifyManifest(manifest, { now, transportSource, requireIdentityBinding: transportSource !== undefined });
  if (!verifiedManifest.valid) return verifiedManifest;
  const verified = verifySignedObject(attestation, manifest.publicKey, { now });
  if (!verified.valid) return verified;
  if (attestation.agentId !== manifest.agentId) return { valid: false, reason: 'agent-identity-mismatch' };
  return verified;
}

export class ReputationBook {
  constructor({ decay = 0.05 } = {}) { this.decay = decay; this.entries = new Map(); }
  record(agentId, outcome) {
    const current = this.entries.get(agentId) ?? { score: 0.5, attempts: 0, successes: 0, failures: 0, conflicts: 0 };
    const target = outcome === 'success' ? 1 : 0;
    current.score = (current.score * (1 - this.decay)) + (target * this.decay);
    current.attempts += 1;
    if (outcome === 'success') current.successes += 1; else current.failures += 1;
    if (outcome === 'conflict') current.conflicts += 1;
    this.entries.set(agentId, current);
    return { ...current };
  }
  get(agentId) { return { ...(this.entries.get(agentId) ?? { score: 0.5, attempts: 0, successes: 0, failures: 0, conflicts: 0 }) }; }
}
