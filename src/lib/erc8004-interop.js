import { stableJson, digest } from './canonical.js';
import { verifyIdentityBindingProof, verifyManifest } from './agent-trust.js';

const ERC8004_REGISTRATION_TYPE = 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1';
const TOKEN_URI_SELECTOR = 'c87b56dd';
const OWNER_OF_SELECTOR = '6352211e';

function assertHex(value, name) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]+$/.test(value)) throw new Error(`${name} must be hex`);
  return value;
}
function encodeUint256(value) {
  const n = BigInt(value);
  if (n < 0n) throw new Error('agentId must be non-negative');
  return n.toString(16).padStart(64, '0');
}
function decodeAbiString(hex) {
  const bytes = Buffer.from(hex.replace(/^0x/, ''), 'hex');
  if (bytes.length < 64) throw new Error('invalid ABI string response');
  const offset = Number(BigInt(`0x${bytes.subarray(0, 32).toString('hex')}`));
  if (offset + 32 > bytes.length) throw new Error('invalid ABI string offset');
  const length = Number(BigInt(`0x${bytes.subarray(offset, offset + 32).toString('hex')}`));
  const start = offset + 32;
  const end = start + length;
  if (end > bytes.length) throw new Error('invalid ABI string length');
  return bytes.subarray(start, end).toString('utf8');
}
function decodeAddress(hex) {
  const value = hex.replace(/^0x/, '');
  if (value.length < 64) throw new Error('invalid ABI address response');
  return `0x${value.slice(-40)}`;
}

export function parseAgentRegistry(agentRegistry) {
  const match = /^([a-z0-9-]+):(\d+):(0x[0-9a-fA-F]{40})$/.exec(agentRegistry ?? '');
  if (!match) throw new Error('invalid ERC-8004 agentRegistry');
  return { namespace: match[1], chainId: Number(match[2]), identityRegistry: match[3] };
}

export function validateRegistrationFile(registration, { expectedRegistry, expectedAgentId } = {}) {
  if (!registration || registration.type !== ERC8004_REGISTRATION_TYPE) return { valid: false, reason: 'invalid-registration-type' };
  if (!registration.name || !registration.description || typeof registration.image !== 'string' || !Array.isArray(registration.services)) return { valid: false, reason: 'missing-registration-fields' };
  if (!Array.isArray(registration.registrations) || registration.registrations.length === 0) return { valid: false, reason: 'missing-registration-reference' };
  const match = registration.registrations.some((item) => item?.agentRegistry === expectedRegistry && String(item?.agentId) === String(expectedAgentId));
  if (!match) return { valid: false, reason: 'on-chain-registration-reference-mismatch' };
  const nknServices = registration.services.filter((service) => service?.name?.toLowerCase() === 'nkn');
  if (nknServices.length !== 1 || !nknServices[0].endpoint) return { valid: false, reason: 'missing-or-ambiguous-nkn-service' };
  return { valid: true, nknService: nknServices[0] };
}

export function buildRegistrationFile({ name, description, nknAddress, agentRegistry, agentId, image = '', capabilities = [], supportedTrust = ['crypto-economic'] }) {
  parseAgentRegistry(agentRegistry);
  if (!name || !description || !nknAddress) throw new Error('name, description and nknAddress are required');
  return {
    type: ERC8004_REGISTRATION_TYPE,
    name,
    description,
    image,
    services: [{ name: 'NKN', endpoint: nknAddress, version: '1' }, ...capabilities.map((capability) => ({ name: 'capability', endpoint: capability }))],
    registrations: [{ agentId: Number(agentId), agentRegistry }],
    supportedTrust,
  };
}

export function verifyExternalAgentAdmission({ registration, agentRegistry, agentId, manifest, transportSource, operatorId, operatorRegistry, verifyOperatorMembership, now = Date.now() }) {
  const registrationResult = validateRegistrationFile(registration, { expectedRegistry: agentRegistry, expectedAgentId: agentId });
  if (!registrationResult.valid) return registrationResult;
  if (registrationResult.nknService.endpoint !== manifest?.agentId) return { valid: false, reason: 'registration-nkn-endpoint-mismatch' };
  const verifiedManifest = verifyManifest(manifest, { now, transportSource, requireIdentityBinding: true });
  if (!verifiedManifest.valid) return { valid: false, reason: `manifest:${verifiedManifest.reason}` };
  const binding = verifyIdentityBindingProof(manifest.identityBinding, { transportSource });
  if (!binding.valid) return { valid: false, reason: `identity-binding:${binding.reason}` };
  if (manifest.publicKey !== manifest.identityBinding.applicationPublicKey) return { valid: false, reason: 'manifest-binding-key-mismatch' };
  if (operatorRegistry && verifyOperatorMembership) {
    if (!operatorId) return { valid: false, reason: 'missing-operator-id' };
    const membership = verifyOperatorMembership({ registry: operatorRegistry, operatorId, nknAddress: transportSource, now });
    if (!membership.valid) return { valid: false, reason: `operator-membership:${membership.reason}` };
  }
  return { valid: true, agentRegistry, agentId: Number(agentId), nknAddress: manifest.agentId, registrationDigest: digest(registration), applicationPublicKey: manifest.publicKey };
}

export async function readIdentityRegistry({ rpcUrl, identityRegistry, agentId, fetchImpl = fetch }) {
  assertHex(identityRegistry, 'identityRegistry');
  const id = encodeUint256(agentId);
  const calls = [
    { method: 'eth_call', params: [{ to: identityRegistry, data: `0x${TOKEN_URI_SELECTOR}${id}` }, 'latest'], id: 1, jsonrpc: '2.0' },
    { method: 'eth_call', params: [{ to: identityRegistry, data: `0x${OWNER_OF_SELECTOR}${id}` }, 'latest'], id: 2, jsonrpc: '2.0' },
  ];
  const responses = await Promise.all(calls.map((body) => fetchImpl(rpcUrl, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(async (response) => {
    if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
    const payload = await response.json();
    if (payload.error) throw new Error(`RPC error: ${payload.error.message ?? 'unknown error'}`);
    return payload.result;
  })));
  return { agentId: Number(agentId), agentURI: decodeAbiString(responses[0]), owner: decodeAddress(responses[1]), identityRegistry };
}

export async function resolveAndVerifyOnChainAgent({ rpcUrl, agentRegistry, agentId, registration, fetchImpl = fetch }) {
  const parsed = parseAgentRegistry(agentRegistry);
  if (parsed.namespace !== 'eip155') throw new Error('only EVM ERC-8004 registries are supported');
  const onChain = await readIdentityRegistry({ rpcUrl, identityRegistry: parsed.identityRegistry, agentId, fetchImpl });
  const registrationResult = validateRegistrationFile(registration, { expectedRegistry: agentRegistry, expectedAgentId: agentId });
  if (!registrationResult.valid) return { valid: false, reason: registrationResult.reason, onChain };
  return { valid: true, onChain, registrationDigest: digest(registration), normalized: stableJson({ agentRegistry, agentId: Number(agentId), agentURI: onChain.agentURI, owner: onChain.owner, registrationDigest: digest(registration) }) };
}

export { ERC8004_REGISTRATION_TYPE };
