import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createNknTransport } from '../lib/nkn-transport.js';
import { createRequest, createResponse, parseEnvelope, BoundedTtlSet } from '../lib/runtime.js';
import { digest } from '../lib/canonical.js';
import { createIdentity, signManifest, verifyManifest, createTaskQuote, verifySignedObject, createAttestation, verifyAttestation, ReputationBook } from '../lib/agent-trust.js';

const TASK = { type: 'market-observation.v1', symbol: 'NKNUSDT' };
const sources = ['coingecko', 'coinpaprika', 'gate', 'adversary'];
const NKN_RPC_ATTEMPTS = Number(process.env.NKN_MARKET_RPC_ATTEMPTS ?? 4);
const NKN_RPC_BACKOFF_MS = Number(process.env.NKN_MARKET_RPC_BACKOFF_MS ?? 1000);
const ALLOW_UNAVAILABLE = process.env.NKN_MARKET_ALLOW_UNAVAILABLE === 'true';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

class NknLiveUnavailableError extends Error {
  constructor(message, cause) {
    super(message, { cause });
    this.name = 'NknLiveUnavailableError';
  }
}

function isNknTransportFailure(error) {
  const message = String(error?.message ?? error ?? '');
  return /NKN connection failed|NKN RPC failed|rpc timeout|WebSocket was closed|WRONG NODE TO CONNECT|connection.*timeout/i.test(message);
}

function decodeRpcResponse(response) {
  if (typeof response === 'string') return JSON.parse(response);
  if (response instanceof Uint8Array || Buffer.isBuffer(response)) return JSON.parse(Buffer.from(response).toString('utf8'));
  return response;
}

function assertResponseEnvelope(response, requestId) {
  if (!response || response.kind !== 'response' || response.requestId !== requestId || !response.payload) {
    throw new NknLiveUnavailableError('NKN returned an invalid or unavailable RPC response');
  }
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally { clearTimeout(timeout); }
}

async function observe(source) {
  if (source === 'coingecko') {
    const data = await fetchJson('https://api.coingecko.com/api/v3/simple/price?ids=nkn&vs_currencies=usd');
    return Number(data?.nkn?.usd);
  }
  if (source === 'coinpaprika') {
    const data = await fetchJson('https://api.coinpaprika.com/v1/tickers/nkn-nkn?quotes=USD');
    return Number(data?.quotes?.USD?.price);
  }
  if (source === 'gate') {
    const data = await fetchJson('https://api.gateio.ws/api/v4/spot/tickers?currency_pair=NKN_USDT');
    return Number(data?.[0]?.last);
  }
  const data = await fetchJson('https://api.coinpaprika.com/v1/tickers/nkn-nkn?quotes=USD');
  return Number((Number(data?.quotes?.USD?.price) * 1.5).toPrecision(8));
}

async function createAgent(source) {
  const identity = createIdentity();
  const transport = await createNknTransport({ identifier: `market-agent-${source}-${process.pid}-${randomUUID().slice(0, 6)}`, numSubClients: 3 });
  const manifest = signManifest({ nknAddress: transport.addr, identity, capabilities: ['market-observation.v1', 'attestation.v1', 'quote.v1'] });
  const seen = new BoundedTtlSet({ max: 1000, ttlMs: 120_000 });
  transport.onMessage(async ({ src, payload }) => {
    try {
      const env = parseEnvelope(payload);
      if (env.recipient !== transport.addr || env.kind !== 'request') return false;
      const key = `${src}:${env.requestId}`;
      if (seen.has(key)) return null;
      seen.add(key);
      if (env.payload?.task?.type === 'manifest-query.v1') {
        return JSON.stringify(createResponse({ requestId: env.requestId, sender: transport.addr, recipient: src, result: manifest, evidence: { digest: digest(manifest) } }));
      }
      if (env.payload?.task?.type === 'quote.v1') {
        const quote = createTaskQuote({ requestId: env.requestId, agentId: transport.addr, capability: 'market-observation.v1', price: source === 'adversary' ? 0 : 0.01, currency: 'NKN', estimatedMs: 500, identity });
        return JSON.stringify(createResponse({ requestId: env.requestId, sender: transport.addr, recipient: src, result: quote, evidence: { digest: digest(quote) } }));
      }
      if (env.payload?.task?.type === 'execute.v1') {
        const price = await observe(source);
        const result = { symbol: TASK.symbol, price, source, capturedAt: Date.now() };
        const attestation = createAttestation({ requestId: env.requestId, agentId: transport.addr, taskDigest: digest(env.payload.task.spec), resultDigest: digest(result), source, capturedAt: result.capturedAt, identity });
        return JSON.stringify(createResponse({ requestId: env.requestId, sender: transport.addr, recipient: src, result, evidence: { attestation } }));
      }
      throw new Error('unsupported task');
    } catch (error) { return JSON.stringify({ error: error.message }); }
  });
  return { source, identity, transport, manifest };
}

async function rpc(client, target, task) {
  let lastError;
  for (let attempt = 1; attempt <= NKN_RPC_ATTEMPTS; attempt += 1) {
    const requestId = randomUUID();
    try {
      const rawResponse = await client.send(target, JSON.stringify(createRequest({ requestId, sender: client.addr, recipient: target, task })));
      const response = decodeRpcResponse(rawResponse);
      assertResponseEnvelope(response, requestId);
      return { requestId, attempt, response };
    } catch (error) {
      if (error instanceof NknLiveUnavailableError) throw error;
      lastError = error;
      if (attempt < NKN_RPC_ATTEMPTS) await sleep(NKN_RPC_BACKOFF_MS * (2 ** (attempt - 1)));
    }
  }
  if (isNknTransportFailure(lastError)) throw new NknLiveUnavailableError(`NKN RPC unavailable after ${NKN_RPC_ATTEMPTS} attempts: ${lastError?.message ?? 'unknown error'}`, lastError);
  throw lastError ?? new Error('NKN RPC failed without an error');
}

async function main() {
  const agents = [];
  let coordinator;
  try {
    coordinator = await createNknTransport({ identifier: `market-coordinator-${process.pid}-${randomUUID().slice(0, 6)}`, numSubClients: 4 });
    for (const source of sources) agents.push(await createAgent(source));
    const reputation = new ReputationBook({ decay: 0.2 });
    const discovered = [];
    for (const agent of agents) {
      const { response } = await rpc(coordinator, agent.transport.addr, { type: 'manifest-query.v1' });
      const manifest = response.payload.result;
      assert.equal(verifyManifest(manifest, { transportSource: agent.transport.addr }).valid, true);
      assert.equal(manifest.agentId, agent.transport.addr);
      discovered.push({ ...agent, manifest });
    }
    const quotes = [];
    for (const agent of discovered) {
      const { response } = await rpc(coordinator, agent.transport.addr, { type: 'quote.v1', spec: TASK });
      const quote = response.payload.result;
      assert.equal(verifySignedObject(quote, agent.manifest.publicKey).valid, true);
      quotes.push({ agent, quote });
    }
    quotes.sort((a, b) => (reputation.get(b.agent.transport.addr).score - reputation.get(a.agent.transport.addr).score) || (a.quote.price - b.quote.price));
    const selected = quotes.slice(0, 3);
    const executions = [];
    for (const entry of selected) {
      const { response, requestId, attempt } = await rpc(coordinator, entry.agent.transport.addr, { type: 'execute.v1', spec: TASK });
      const result = response.payload.result;
      const attestation = response.payload.evidence?.attestation;
      assert.equal(verifyAttestation(attestation, entry.agent.manifest, { transportSource: entry.agent.transport.addr }).valid, true);
      assert.equal(attestation.taskDigest, digest(TASK));
      assert.equal(attestation.resultDigest, digest(result));
      executions.push({ agent: entry.agent.transport.addr, source: entry.agent.source, quote: entry.quote.price, result, attestation, requestId, attempts: attempt });
    }
    const honest = executions.filter((x) => x.source !== 'adversary');
    const adversary = executions.find((x) => x.source === 'adversary');
    assert.ok(honest.length >= 2, 'at least two honest agents must execute');
    if (adversary) {
      const median = [...honest].sort((a, b) => a.result.price - b.result.price)[Math.floor(honest.length / 2)].result.price;
      assert.ok(Math.abs(adversary.result.price - median) / median > 0.2, 'adversary must materially disagree');
      reputation.record(adversary.agent, 'conflict');
    }
    for (const agent of honest) reputation.record(agent.agent, 'success');
    console.log(JSON.stringify({ phase: 'result', report: {
      phase: 'attested-agent-market', task: TASK,
      discoveredAgents: discovered.map((a) => ({ source: a.source, address: a.transport.addr, capabilities: a.manifest.capabilities, fingerprint: a.manifest.fingerprint })),
      selectedAgents: selected.map((x) => ({ source: x.agent.source, address: x.agent.transport.addr, quotedPrice: x.quote.price })),
      executions: executions.map((x) => ({ source: x.source, price: x.result.price, attestationVerified: true, attempts: x.attempts })),
      reputation: Object.fromEntries(agents.map((a) => [a.source, reputation.get(a.transport.addr)])),
    } }, null, 2));
  } catch (error) {
    if (ALLOW_UNAVAILABLE && (error instanceof NknLiveUnavailableError || isNknTransportFailure(error))) {
      console.log(JSON.stringify({ phase: 'unavailable', status: 'unavailable', reason: error.message }));
      return;
    }
    throw error;
  } finally {
    await Promise.allSettled(agents.map((a) => a.transport.close()));
    if (coordinator) await coordinator.close();
  }
}

main().catch((error) => { console.error(JSON.stringify({ phase: 'failed', error: error.stack ?? error.message })); process.exitCode = 1; });
