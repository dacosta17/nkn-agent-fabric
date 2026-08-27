import assert from 'node:assert/strict';
import test from 'node:test';
import { createIdentity } from '../src/lib/agent-trust.js';
import { createRegistry, signOperatorRecord } from '../src/lib/operator-registry.js';
import { createErc8004Registration, verifyErc8004NknBinding, ERC8004_REGISTRATION_TYPE } from '../src/lib/erc8004-bridge.js';

function fixture() {
  const identity = createIdentity();
  const operatorRecord = signOperatorRecord({
    identity,
    operatorId: 'operator-a',
    nknAddresses: ['id.nkn.example'],
    capabilities: ['market-observation', 'verification'],
    expiresAt: Date.now() + 60_000,
  });
  return { identity, operatorRecord };
}

test('creates an ERC-8004 registration advertising NKN without inventing on-chain state', () => {
  const { operatorRecord } = fixture();
  const registration = createErc8004Registration({
    name: 'NKN Market Verifier',
    description: 'Independent market observation agent over NKN.',
    agentId: 42,
    agentRegistry: 'eip155:1:0x0000000000000000000000000000000000008004',
    nknAddresses: operatorRecord.nknAddresses,
    capabilities: operatorRecord.capabilities,
    supportedTrust: ['reputation', 'crypto-economic'],
  });

  assert.equal(registration.type, ERC8004_REGISTRATION_TYPE);
  assert.deepEqual(registration.registrations, [{ agentId: 42, agentRegistry: 'eip155:1:0x0000000000000000000000000000000000008004' }]);
  assert.equal(registration.services[0].name, 'NKN');
  assert.equal(registration.services[0].endpoint, 'nkn:id.nkn.example');
});

test('verifies ERC-8004 identity and NKN operator binding together', () => {
  const { operatorRecord } = fixture();
  const agentRegistry = 'eip155:1:0x0000000000000000000000000000000000008004';
  const registration = createErc8004Registration({
    name: 'NKN Market Verifier',
    description: 'Independent market observation agent over NKN.',
    agentId: 42,
    agentRegistry,
    nknAddresses: operatorRecord.nknAddresses,
  });

  const result = verifyErc8004NknBinding({ registration, operatorRecord, agentId: 42, agentRegistry });
  assert.equal(result.valid, true);
  assert.deepEqual(result.matchedNknAddresses, ['id.nkn.example']);
  assert.equal(result.operatorId, 'operator-a');
});

test('rejects an ERC-8004 registration bound to a different agent identity', () => {
  const { operatorRecord } = fixture();
  const agentRegistry = 'eip155:1:0x0000000000000000000000000000000000008004';
  const registration = createErc8004Registration({ name: 'Verifier', description: 'test', agentId: 42, agentRegistry, nknAddresses: operatorRecord.nknAddresses });
  assert.equal(verifyErc8004NknBinding({ registration, operatorRecord, agentId: 43, agentRegistry }).reason, 'erc8004-identity-not-bound');
});

test('rejects an ERC-8004 registration advertising an unrelated NKN address', () => {
  const { operatorRecord } = fixture();
  const agentRegistry = 'eip155:1:0x0000000000000000000000000000000000008004';
  const registration = createErc8004Registration({ name: 'Verifier', description: 'test', agentId: 42, agentRegistry, nknAddresses: ['id.attacker'] });
  assert.equal(verifyErc8004NknBinding({ registration, operatorRecord, agentId: 42, agentRegistry }).reason, 'nkn-address-not-bound');
});

test('rejects a malformed ERC-8004 document', () => {
  const { operatorRecord } = fixture();
  assert.equal(verifyErc8004NknBinding({ registration: {}, operatorRecord, agentId: 42, agentRegistry: 'eip155:1:0x8004' }).reason, 'invalid-registration-type');
});

test('registry remains independently verifiable after bridge conversion', () => {
  const { operatorRecord } = fixture();
  const registry = createRegistry([operatorRecord]);
  assert.equal(registry.records[0].operatorId, 'operator-a');
  assert.equal(registry.records[0].recordDigest, operatorRecord.recordDigest);
});
