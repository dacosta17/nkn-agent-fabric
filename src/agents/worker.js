import { createNknTransport } from '../lib/nkn-transport.js';
import { createResponse, parseEnvelope, BoundedTtlSet } from '../lib/runtime.js';
import { validateObservation } from '../lib/tasks.js';
import { digest } from '../lib/canonical.js';
import { createIdentity, createIdentityBindingProof, signManifest } from '../lib/agent-trust.js';
import { loadOrCreatePersistentIdentity } from '../lib/persistent-identity.js';

const source = process.env.SOURCE ?? 'coingecko';
const providerId = process.env.PROVIDER_ID ?? source;
const sourceGroup = process.env.SOURCE_GROUP ?? source;
const operatorId = process.env.OPERATOR_ID;
if (!operatorId) throw new Error('OPERATOR_ID is required; operator identity is a security input');

const identityFilePath = process.env.OPERATOR_IDENTITY_FILE;
const identityPassphrase = process.env.OPERATOR_IDENTITY_PASSPHRASE;
if ((identityFilePath && !identityPassphrase) || (!identityFilePath && identityPassphrase)) {
  throw new Error('OPERATOR_IDENTITY_FILE and OPERATOR_IDENTITY_PASSPHRASE must be provided together');
}

const persistentIdentity = identityFilePath
  ? loadOrCreatePersistentIdentity({ filePath: identityFilePath, passphrase: identityPassphrase })
  : null;
const identity = persistentIdentity?.identity ?? createIdentity();
const transportIdentifier = persistentIdentity
  ? `${source}-${persistentIdentity.operatorFingerprint.slice(0, 16)}`
  : `${source}-${process.pid}`;
const transport = await createNknTransport({
  identifier: transportIdentifier,
  ...(persistentIdentity ? { seed: persistentIdentity.nknSeed } : {}),
});
const manifest = signManifest({ nknAddress: transport.addr, identity, capabilities: ['market-observation'] });
const seen = new BoundedTtlSet();

async function observe(task) {
  if (task.type !== 'market-observation.v1') throw new Error('unsupported task');
  const timestamp = Date.now();
  let price;
  if (source === 'coingecko') {
    const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=nkn&vs_currencies=usd', { headers: { accept: 'application/json' } });
    if (!r.ok) throw new Error(`CoinGecko HTTP ${r.status}`);
    const body = await r.json();
    price = Number(body?.nkn?.usd);
  } else if (source === 'binance') {
    const r = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=NKNUSDT', { headers: { accept: 'application/json' } });
    if (!r.ok) throw new Error(`Binance HTTP ${r.status}`);
    const body = await r.json();
    price = Number(body?.price);
  } else throw new Error(`unknown source ${source}`);
  const result = { symbol: task.symbol, price, timestamp, source };
  validateObservation(result);
  return result;
}

transport.onMessage(async ({ src, payload }) => {
  try {
    const env = parseEnvelope(payload);
    if (env.recipient !== transport.addr || seen.has(env.requestId)) return false;
    seen.add(env.requestId);
    if (env.kind === 'identity-challenge') {
      return JSON.stringify({ type: 'identity-response.v1', challenge: env.payload.challenge, nknAddress: transport.addr, manifest, identityBinding: createIdentityBindingProof({ nknAddress: transport.addr, identity }) });
    }
    if (env.kind !== 'request') return false;
    const result = await observe(env.payload.task);
    const evidence = { source, providerId, operatorId, sourceGroup, capturedAt: result.timestamp, digest: digest(result) };
    return JSON.stringify(createResponse({ requestId: env.requestId, sender: transport.addr, recipient: src, result, evidence }));
  } catch (err) {
    return JSON.stringify({ error: err.message });
  }
});

await new Promise((resolve) => transport.onConnect(resolve));
console.log(JSON.stringify({ role: 'worker', source, providerId, sourceGroup, operatorId, address: transport.addr, operatorFingerprint: persistentIdentity?.operatorFingerprint ?? null, persistentIdentity: Boolean(persistentIdentity), manifest }));
