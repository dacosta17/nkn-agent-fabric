import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import {
  createEconomicReceipt,
  receiptDigest,
  verifyEconomicReceipt,
} from '../src/lib/economic-receipt.js';

const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const base = {
  paymentNetwork: 'x402:base',
  paymentReference: '0xpayment-001',
  payer: '0xpayer',
  payee: '0xpayee',
  asset: 'USDC',
  amount: 250000,
  taskDigest: 'task-sha256',
  resultDigest: 'result-sha256',
  nknAddress: '2c-example.nkn',
  issuedAt: 1_750_000_000_000,
  nonce: '01J9-ECO-RECEIPT',
};

const receipt = createEconomicReceipt(base, privateKey);

test('creates and verifies a receipt bound to payment, task, result and NKN endpoint', () => {
  assert.equal(verifyEconomicReceipt(receipt, publicKey, {
    now: base.issuedAt + 1000,
    expectedTaskDigest: base.taskDigest,
    expectedResultDigest: base.resultDigest,
    expectedNknAddress: base.nknAddress,
    expectedPaymentReference: base.paymentReference,
  }).valid, true);
  assert.equal(typeof receiptDigest(receipt), 'string');
});

test('rejects tampering with economic or execution fields', () => {
  const tampered = { ...receipt, amount: 999999 };
  assert.equal(verifyEconomicReceipt(tampered, publicKey, { now: base.issuedAt + 1000 }).reason, 'invalid-signature');
});

test('rejects a receipt replayed outside its freshness window', () => {
  const result = verifyEconomicReceipt(receipt, publicKey, { now: base.issuedAt + 5 * 60_001 });
  assert.equal(result.reason, 'stale');
});

test('rejects a valid signature bound to the wrong NKN endpoint', () => {
  const result = verifyEconomicReceipt(receipt, publicKey, {
    now: base.issuedAt + 1000,
    expectedNknAddress: 'different.nkn',
  });
  assert.equal(result.reason, 'nkn-address-mismatch');
});

test('rejects task substitution even when the receipt itself is correctly signed', () => {
  const result = verifyEconomicReceipt(receipt, publicKey, {
    now: base.issuedAt + 1000,
    expectedTaskDigest: 'different-task',
  });
  assert.equal(result.reason, 'task-mismatch');
});
