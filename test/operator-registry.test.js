import assert from 'node:assert/strict';
import test from 'node:test';
import { createIdentity } from '../src/lib/agent-trust.js';
import { createRegistry, signOperatorRecord, verifyOperatorMembership, verifyOperatorRecord } from '../src/lib/operator-registry.js';

test('signed operator record binds operator identity to NKN address', () => {
  const identity = createIdentity();
  const record = signOperatorRecord({ identity, operatorId: 'op-a', nknAddresses: ['id.a'], capabilities: ['market-observation'], expiresAt: Date.now() + 60_000 });
  assert.equal(verifyOperatorRecord(record, { expectedNknAddress: 'id.a' }).valid, true);
  assert.equal(verifyOperatorMembership({ registry: createRegistry([record]), operatorId: 'op-a', nknAddress: 'id.a' }).valid, true);
});

test('membership fails for an unbound NKN address', () => {
  const identity = createIdentity();
  const record = signOperatorRecord({ identity, operatorId: 'op-a', nknAddresses: ['id.a'], expiresAt: Date.now() + 60_000 });
  const registry = createRegistry([record]);
  assert.equal(verifyOperatorMembership({ registry, operatorId: 'op-a', nknAddress: 'id.attacker' }).reason, 'nkn-address-not-bound');
});

test('tampering with a record is rejected', () => {
  const identity = createIdentity();
  const record = signOperatorRecord({ identity, operatorId: 'op-a', nknAddresses: ['id.a'], expiresAt: Date.now() + 60_000 });
  const tampered = { ...record, operatorId: 'op-b' };
  assert.equal(verifyOperatorRecord(tampered).valid, false);
});

test('registry rejects duplicate operator identities', () => {
  const a = createIdentity();
  const b = createIdentity();
  const r1 = signOperatorRecord({ identity: a, operatorId: 'op-a', expiresAt: Date.now() + 60_000 });
  const r2 = signOperatorRecord({ identity: b, operatorId: 'op-a', expiresAt: Date.now() + 60_000 });
  assert.throws(() => createRegistry([r1, r2]), /duplicate operator/);
});

test('expired records are rejected', () => {
  const identity = createIdentity();
  const now = Date.now();
  const record = signOperatorRecord({ identity, operatorId: 'op-a', createdAt: now - 120_000, expiresAt: now - 60_000 });
  assert.equal(verifyOperatorRecord(record, { now }).reason, 'record-expired-or-not-yet-valid');
});
