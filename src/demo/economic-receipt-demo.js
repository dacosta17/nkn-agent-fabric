import { generateKeyPairSync } from 'node:crypto';
import { createEconomicReceipt, verifyEconomicReceipt } from '../lib/economic-receipt.js';

const { privateKey, publicKey } = generateKeyPairSync('ed25519');
const issuedAt = Date.now();
const settlement = {
  success: true,
  transaction: '0x' + 'ab'.repeat(32),
  network: 'base',
  payer: '0x1111111111111111111111111111111111111111',
};

const taskDigest = 'sha256:task-demo';
const resultDigest = 'sha256:result-demo';
const nknAddress = 'demo-agent.nkn';

if (!settlement.success || !settlement.transaction) throw new Error('settlement verification failed');

const receipt = createEconomicReceipt({
  paymentNetwork: `x402:${settlement.network}`,
  paymentReference: settlement.transaction,
  payer: settlement.payer,
  payee: '0x2222222222222222222222222222222222222222',
  asset: 'USDC',
  amount: 250000,
  taskDigest,
  resultDigest,
  nknAddress,
  issuedAt,
  nonce: 'demo-economic-receipt-001',
}, privateKey);

const verification = verifyEconomicReceipt(receipt, publicKey, {
  now: issuedAt + 1000,
  expectedTaskDigest: taskDigest,
  expectedResultDigest: resultDigest,
  expectedNknAddress: nknAddress,
  expectedPaymentReference: settlement.transaction,
});

console.log(JSON.stringify({
  demo: 'x402-to-nkn-economic-receipt',
  settlement,
  receipt: { ...receipt, signature: '<ed25519-signature>' },
  verification,
  claim: 'a verified payment reference can be cryptographically bound to the exact NKN-delivered agent execution',
  limitation: 'The demo uses a deterministic settlement fixture; production adapters must verify the x402 facilitator response and transaction before issuing a receipt.',
}, null, 2));
