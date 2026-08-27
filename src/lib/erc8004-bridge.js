const ERC8004_REGISTRATION_TYPE = 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1';
const NKN_SERVICE_NAME = 'NKN';
const NKN_SCHEME = 'nkn:';

function requireString(value, name) {
  if (typeof value !== 'string' || value.length === 0) throw new TypeError(`${name} must be a non-empty string`);
}

function normalizeList(values = []) {
  return [...new Set(values)].filter(Boolean).sort();
}

function nknEndpoint(address) {
  requireString(address, 'NKN address');
  return `${NKN_SCHEME}${address}`;
}

function parseNknEndpoint(endpoint) {
  if (typeof endpoint !== 'string' || !endpoint.startsWith(NKN_SCHEME)) return null;
  const address = endpoint.slice(NKN_SCHEME.length);
  return address || null;
}

/**
 * Build an ERC-8004 registration file that advertises the agent's NKN transport.
 * This does not register an agent on-chain; it produces the portable registration
 * document referenced by an ERC-8004 Identity Registry.
 */
export function createErc8004Registration({
  name,
  description,
  image,
  agentId,
  agentRegistry,
  nknAddresses = [],
  capabilities = [],
  active = true,
  supportedTrust = [],
  additionalServices = [],
}) {
  requireString(name, 'name');
  requireString(description, 'description');
  requireString(agentRegistry, 'agentRegistry');
  if (!Number.isSafeInteger(agentId) || agentId < 0) throw new TypeError('agentId must be a non-negative safe integer');
  if (!Array.isArray(nknAddresses) || nknAddresses.length === 0) throw new TypeError('at least one NKN address is required');

  const addresses = normalizeList(nknAddresses);
  const normalizedCapabilities = normalizeList(capabilities);
  const services = addresses.map((address) => ({
    name: NKN_SERVICE_NAME,
    endpoint: nknEndpoint(address),
    version: '1',
    ...(normalizedCapabilities.length ? { capabilities: normalizedCapabilities } : {}),
  }));

  return {
    type: ERC8004_REGISTRATION_TYPE,
    name,
    description,
    ...(image ? { image } : {}),
    services: [...services, ...additionalServices],
    active: Boolean(active),
    registrations: [{ agentId, agentRegistry }],
    ...(supportedTrust.length ? { supportedTrust: normalizeList(supportedTrust) } : {}),
  };
}

/**
 * Verify the application-layer binding between an ERC-8004 registration file,
 * an ERC-8004 identity, and an existing signed NKN operator record.
 *
 * Chain state is intentionally out of scope: callers must obtain the authoritative
 * agentURI/registry state from the ERC-8004 chain before invoking this verifier.
 */
export function verifyErc8004NknBinding({ registration, operatorRecord, agentId, agentRegistry }) {
  if (!registration || registration.type !== ERC8004_REGISTRATION_TYPE) return { valid: false, reason: 'invalid-registration-type' };
  if (!operatorRecord || !Array.isArray(operatorRecord.nknAddresses)) return { valid: false, reason: 'invalid-operator-record' };
  if (!Number.isSafeInteger(agentId) || agentId < 0 || typeof agentRegistry !== 'string' || !agentRegistry) return { valid: false, reason: 'invalid-agent-identity' };

  const registered = registration.registrations?.some((item) => item?.agentId === agentId && item?.agentRegistry === agentRegistry);
  if (!registered) return { valid: false, reason: 'erc8004-identity-not-bound' };

  const advertisedAddresses = (Array.isArray(registration.services) ? registration.services : [])
    .filter((service) => service?.name === NKN_SERVICE_NAME)
    .map((service) => parseNknEndpoint(service.endpoint))
    .filter(Boolean);
  const boundAddresses = normalizeList(operatorRecord.nknAddresses);
  const matchedAddresses = advertisedAddresses.filter((address) => boundAddresses.includes(address));
  if (matchedAddresses.length === 0) return { valid: false, reason: 'nkn-address-not-bound' };

  return {
    valid: true,
    agentId,
    agentRegistry,
    matchedNknAddresses: normalizeList(matchedAddresses),
    operatorId: operatorRecord.operatorId,
    recordDigest: operatorRecord.recordDigest,
  };
}

export { ERC8004_REGISTRATION_TYPE, NKN_SERVICE_NAME };
