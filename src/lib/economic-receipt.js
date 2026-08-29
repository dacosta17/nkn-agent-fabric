import {
  createHash,
  createPublicKey,
  sign,
  verify,
} from 'node:crypto';

const VERSION = 'economic-receipt-v1';
const STRING_FIELDS = [
  'paymentNetwork',
  'paymentReference',
  'payer',
  'payee',
  'asset',
  'taskDigest',
  'resultDigest',
  'nknAddress',
  'nonce',
];

function assertString(value, field) {
  if (typeof value !== 'string' || value.length === 0) throw new TypeError(`${field} must be a non-empty string`);
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function digest(value) {
  return createHash('sha256').update(canonical(value)).digest('hex');
}

function normalizePublicKey(key) {
  return key?.type === 'public' ? key : createPublicKey(key);
}

export function receiptPayload(receipt) {
  const payload = { ...receipt };
  delete payload.signature;
  return payload;
}

export function receiptDigest(receipt) {
  return digest(receiptPayload(receipt));
}

export function createEconomicReceipt(input, privateKey) {
  for (const field of STRING_FIELDS) assertString(input[field], field);
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0) throw new TypeError('amount must be a positive integer in atomic units');
  if (!Number.isSafeInteger(input.issuedAt) || input.issuedAt <= 0) throw new TypeError('issuedAt must be a positive Unix timestamp in milliseconds');

  const payload = {
    version: VERSION,
    paymentNetwork: input.paymentNetwork,
    paymentReference: input.paymentReference,
    payer: input.payer,
    payee: input.payee,
    asset: input.asset,
    amount: input.amount,
    taskDigest: input.taskDigest,
    resultDigest: input.resultDigest,
    nknAddress: input.nknAddress,
    issuedAt: input.issuedAt,
    nonce: input.nonce,
  };

  const signature = sign(null, Buffer.from(canonical(payload)), privateKey).toString('base64url');
  return { ...payload, signature };
}

export function verifyEconomicReceipt(receipt, publicKey, {
  now = Date.now(),
  maxAgeMs = 5 * 60_000,
  expectedTaskDigest,
  expectedResultDigest,
  expectedNknAddress,
  expectedPaymentReference,
} = {}) {
  if (!receipt || receipt.version !== VERSION || typeof receipt.signature !== 'string') return { valid: false, reason: 'invalid-format' };
  for (const field of STRING_FIELDS) if (typeof receipt[field] !== 'string' || receipt[field].length === 0) return { valid: false, reason: `missing-${field}` };
  if (!Number.isSafeInteger(receipt.amount) || receipt.amount <= 0) return { valid: false, reason: 'invalid-amount' };
  if (!Number.isSafeInteger(receipt.issuedAt)) return { valid: false, reason: 'invalid-issued-at' };
  if (receipt.issuedAt > now + 30_000) return { valid: false, reason: 'future-issued-at' };
  if (now - receipt.issuedAt > maxAgeMs) return { valid: false, reason: 'stale' };
  if (expectedTaskDigest && receipt.taskDigest !== expectedTaskDigest) return { valid: false, reason: 'task-mismatch' };
  if (expectedResultDigest && receipt.resultDigest !== expectedResultDigest) return { valid: false, reason: 'result-mismatch' };
  if (expectedNknAddress && receipt.nknAddress !== expectedNknAddress) return { valid: false, reason: 'nkn-address-mismatch' };
  if (expectedPaymentReference && receipt.paymentReference !== expectedPaymentReference) return { valid: false, reason: 'payment-reference-mismatch' };

  try {
    const cryptographicallyValid = verify(null, Buffer.from(canonical(receiptPayload(receipt))), normalizePublicKey(publicKey), Buffer.from(receipt.signature, 'base64url'));
    if (!cryptographicallyValid) return { valid: false, reason: 'invalid-signature' };
  } catch {
    return { valid: false, reason: 'invalid-signature' };
  }
  return { valid: true, digest: receiptDigest(receipt) };
}

export { VERSION as ECONOMIC_RECEIPT_VERSION };
