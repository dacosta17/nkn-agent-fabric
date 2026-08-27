import assert from 'node:assert/strict';
import test from 'node:test';
import { createIdentity, createIdentityBindingProof, signManifest } from './agent-trust.js';
import { buildRegistrationFile, parseAgentRegistry, validateRegistrationFile, verifyExternalAgentAdmission } from './erc8004-interop.js';

test('parses an ERC-8004 EVM registry identifier', () => {
  assert.deepEqual(parseAgentRegistry('eip155:11155111:0x8004a6090Cd10A7288092483047B097295Fb8847'), {
    namespace: 'eip155', chainId: 11155111, identityRegistry: '0x8004a6090Cd10A7288092483047B097295Fb8847',
  });
});

test('builds and validates a registration file that advertises NKN', () => {
  const registration = buildRegistrationFile({
    name: 'External NKN Agent',
    description: 'Independent verifier',
    nknAddress: 'agent.abcdef',
    agentRegistry: 'eip155:11155111:0x8004a6090Cd10A7288092483047B097295Fb8847',
    agentId: 42,
  });
  const result = validateRegistrationFile(registration, {
    expectedRegistry: 'eip155:11155111:0x8004a6090Cd10A7288092483047B097295Fb8847',
    expectedAgentId: 42,
  });
  assert.equal(result.valid, true);
  assert.equal(result.nknService.endpoint, 'agent.abcdef');
});

test('rejects a registration that points at a different on-chain identity', () => {
  const registration = buildRegistrationFile({
    name: 'External NKN Agent', description: 'Independent verifier', nknAddress: 'agent.abcdef',
    agentRegistry: 'eip155:11155111:0x8004a6090Cd10A7288092483047B097295Fb8847', agentId: 42,
  });
  assert.equal(validateRegistrationFile(registration, { expectedRegistry: registration.registrations[0].agentRegistry, expectedAgentId: 43 }).reason, 'on-chain-registration-reference-mismatch');
});

test('admits an external agent only when the ERC-8004 registration and NKN binding agree', () => {
  const identity = createIdentity();
  const nknAddress = 'agent.abcdef';
  const binding = createIdentityBindingProof({ nknAddress, identity });
  const manifest = signManifest({ nknAddress, identity, capabilities: ['market-observation'], identityBinding: binding });
  const registration = buildRegistrationFile({
    name: 'External NKN Agent', description: 'Independent verifier', nknAddress,
    agentRegistry: 'eip155:11155111:0x8004a6090Cd10A7288092483047B097295Fb8847', agentId: 42,
  });
  const result = verifyExternalAgentAdmission({ registration, agentRegistry: registration.registrations[0].agentRegistry, agentId: 42, manifest, transportSource: nknAddress });
  assert.equal(result.valid, true);
});

test('rejects an external agent when its NKN endpoint differs from the signed manifest', () => {
  const identity = createIdentity();
  const nknAddress = 'agent.abcdef';
  const binding = createIdentityBindingProof({ nknAddress, identity });
  const manifest = signManifest({ nknAddress, identity, capabilities: ['market-observation'], identityBinding: binding });
  const registration = buildRegistrationFile({
    name: 'External NKN Agent', description: 'Independent verifier', nknAddress: 'other.abcdef',
    agentRegistry: 'eip155:11155111:0x8004a6090Cd10A7288092483047B097295Fb8847', agentId: 42,
  });
  const result = verifyExternalAgentAdmission({ registration, agentRegistry: registration.registrations[0].agentRegistry, agentId: 42, manifest, transportSource: nknAddress });
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'registration-nkn-endpoint-mismatch');
});
