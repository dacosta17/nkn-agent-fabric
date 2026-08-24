import assert from 'node:assert/strict';
import http from 'node:http';
import { createHash, randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import nkn from 'nkn-sdk';
import { createNknTransport } from '../lib/nkn-transport.js';
import { createRequest, createResponse, parseEnvelope, BoundedTtlSet } from '../lib/runtime.js';

const SYMBOL = 'NKNUSDT';
const ROUNDS = Number(process.env.NKN_INTEGRATION_ROUNDS ?? 6);
const RTT_SAMPLES = Number(process.env.NKN_RTT_SAMPLES ?? 20);
const TOLERANCE = Number(process.env.NKN_PRICE_TOLERANCE ?? 0.05);
const MAX_OBSERVATION_AGE_MS = Number(process.env.NKN_MAX_OBSERVATION_AGE_MS ?? 10_000);
const RESPONSE_TIMEOUT_MS = Number(process.env.NKN_RESPONSE_TIMEOUT_MS ?? 7000);

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return null;
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return Number(sorted[index].toFixed(2));
}

function digest(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function quorumDecision(observations, now = Date.now()) {
  const valid = observations.filter((o) => (
    Number.isFinite(o.price) &&
    o.price > 0 &&
    Number.isInteger(o.capturedAt) &&
    now - o.capturedAt <= MAX_OBSERVATION_AGE_MS
  ));
  const stale = observations
    .filter((o) => Number.isInteger(o.capturedAt) && now - o.capturedAt > MAX_OBSERVATION_AGE_MS)
    .map((o) => o.source);
  const invalid = observations.filter((o) => !valid.includes(o) && !stale.includes(o.source) && o.source).map((o) => o.source);

  if (valid.length < 2) return { quorum: false, reason: 'fewer-than-two-fresh-valid-observations', stale, invalid };

  const groups = [];
  for (const item of valid) {
    let group = groups.find((g) => Math.abs(g.anchor.price - item.price) / g.anchor.price <= TOLERANCE);
    if (!group) {
      group = { anchor: item, members: [] };
      groups.push(group);
    }
    group.members.push(item);
  }

  groups.sort((a, b) => b.members.length - a.members.length);
  const winner = groups[0];
  if (winner.members.length < 2) return { quorum: false, reason: 'no-two-source-price-agreement', groups, stale, invalid };

  return {
    quorum: true,
    sourceCount: winner.members.length,
    price: Number((winner.members.reduce((sum, item) => sum + item.price, 0) / winner.members.length).toFixed(8)),
    sources: winner.members.map((item) => item.source),
    outliers: valid.filter((item) => !winner.members.includes(item)).map((item) => item.source),
    stale,
    invalid,
    groups,
  };
}

async function fetchJson(url, init = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, headers: { accept: 'application/json', ...(init.headers ?? {}) } });
    if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function observeFromSource(source) {
  if (source === 'coingecko') {
    const apiKey = process.env.COINGECKO_DEMO_API_KEY;
    const url = new URL('https://api.coingecko.com/api/v3/simple/price');
    url.searchParams.set('ids', 'nkn');
    url.searchParams.set('vs_currencies', 'usd');
    if (apiKey) url.searchParams.set('x_cg_demo_api_key', apiKey);
    const data = await fetchJson(url);
    return { source, venue: 'CoinGecko', price: Number(data?.nkn?.usd), capturedAt: Date.now() };
  }

  if (source === 'coinpaprika') {
    const data = await fetchJson('https://api.coinpaprika.com/v1/tickers/nkn-nkn?quotes=USD');
    return { source, venue: 'CoinPaprika', price: Number(data?.quotes?.USD?.price), capturedAt: Date.now() };
  }

  if (source === 'gate') {
    const data = await fetchJson('https://api.gateio.ws/api/v4/spot/tickers?currency_pair=NKN_USDT');
    return { source, venue: 'Gate', price: Number(data?.[0]?.last), capturedAt: Date.now() };
  }

  if (source === 'adversary') {
    return { source, venue: 'Byzantine-Injected', price: 0.12345678, capturedAt: Date.now() };
  }

  throw new Error(`unknown source ${source}`);
}

async function startWorker(source) {
  const transport = await createNknTransport({
    identifier: `integration-worker-${source}-${process.pid}-${randomUUID().slice(0, 8)}`,
    numSubClients: 2,
  });
  const seen = new BoundedTtlSet({ max: 1000, ttlMs: 120_000 });

  transport.onMessage(async ({ src, payload }) => {
    try {
      const env = parseEnvelope(payload);
      if (env.recipient !== transport.addr || env.kind !== 'request') return false;
      const key = `${src}:${env.requestId}`;
      if (seen.has(key)) return null;
      seen.add(key);

      if (env.payload?.task?.type === 'price-observation.v1') {
        const result = await observeFromSource(source);
        if (!Number.isFinite(result.price) || result.price <= 0) throw new Error(`provider ${source} returned invalid price`);
        const evidence = { source, capturedAt: result.capturedAt, digest: digest(result) };
        return JSON.stringify(createResponse({ requestId: env.requestId, sender: transport.addr, recipient: src, result, evidence }));
      }

      if (env.payload?.task?.type === 'ping.v1') {
        return JSON.stringify(createResponse({
          requestId: env.requestId,
          sender: transport.addr,
          recipient: src,
          result: { ok: true, worker: source, at: Date.now() },
          evidence: { source, digest: digest({ ok: true, worker: source }) },
        }));
      }

      throw new Error('unsupported task type');
    } catch (error) {
      return JSON.stringify({ error: error.message, source });
    }
  });

  return { source, transport };
}

async function rpc(client, address, payload) {
  const started = performance.now();
  const requestId = randomUUID();
  const request = createRequest({ requestId, sender: client.addr, recipient: address, task: payload });
  const reply = await client.send(address, JSON.stringify(request));
  const elapsed = performance.now() - started;
  return { requestId, elapsed, reply: typeof reply === 'string' ? JSON.parse(reply) : reply };
}

async function sessionSmokeTest(coordinator, worker) {
  worker.transport.listen();
  let acceptedResolve;
  const accepted = new Promise((resolve) => { acceptedResolve = resolve; });
  worker.transport.onSession((session) => acceptedResolve(session));

  const session = await coordinator.dial(worker.transport.addr);
  const payload = Buffer.from('NKN-SESSION-PING');
  await session.write(payload);
  const serverSession = await Promise.race([
    accepted,
    new Promise((_, reject) => setTimeout(() => reject(new Error('session accept timeout')), RESPONSE_TIMEOUT_MS)),
  ]);
  const received = await serverSession.read(payload.length);
  await serverSession.write(Buffer.from('NKN-SESSION-PONG'));
  const reply = await session.read(-1);
  assert.equal(Buffer.from(received).toString(), payload.toString());
  assert.equal(Buffer.from(reply).toString(), 'NKN-SESSION-PONG');
  return true;
}

async function centralHttpBaseline(sampleCount) {
  const server = http.createServer((req, res) => {
    if (req.url === '/ping') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, at: Date.now() }));
      return;
    }
    res.writeHead(404).end();
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const timings = [];
  try {
    for (let i = 0; i < sampleCount; i += 1) {
      const started = performance.now();
      const response = await fetch(`http://127.0.0.1:${port}/ping`);
      assert.equal(response.status, 200);
      await response.json();
      timings.push(performance.now() - started);
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
  return timings;
}

async function main() {
  const coordinator = await createNknTransport({ identifier: `integration-coordinator-${process.pid}-${randomUUID().slice(0, 8)}`, numSubClients: 2 });
  const workers = await Promise.all([
    startWorker('coingecko'),
    startWorker('coinpaprika'),
    startWorker('gate'),
    startWorker('adversary'),
  ]);

  const metrics = {
    protocol: { packet: false, session: false },
    consensusRounds: [],
    nknRttMs: [],
    centralRttMs: [],
    resilience: { adversaryRejected: false, quorumSurvivedAdversaryFailure: false, quorumFailureDetected: false },
  };

  try {
    console.log(JSON.stringify({ phase: 'ready', coordinator: coordinator.addr, workers: workers.map((w) => ({ source: w.source, address: w.transport.addr })) }));

    const first = await rpc(coordinator, workers[0].transport.addr, { type: 'ping.v1' });
    assert.equal(first.reply?.payload?.result?.ok, true);
    metrics.protocol.packet = true;
    metrics.protocol.session = await sessionSmokeTest(coordinator, workers[0]);

    const workerBySource = new Map(workers.map((w) => [w.source, w]));
    const honestSources = new Set(['coingecko', 'coinpaprika', 'gate']);

    for (let round = 1; round <= ROUNDS; round += 1) {
      const activeWorkers = workers.filter((w) => !w.transport.isClosed);
      const observations = [];
      for (const worker of activeWorkers) {
        try {
          const response = await rpc(coordinator, worker.transport.addr, { type: 'price-observation.v1', symbol: SYMBOL, round });
          const result = response.reply?.payload?.result;
          const evidence = response.reply?.payload?.evidence;
          if (!result || !evidence) throw new Error(response.reply?.error ?? 'missing result/evidence');
          if (digest(result) !== evidence.digest) throw new Error('evidence digest mismatch');
          observations.push({ ...result, evidence, elapsed: response.elapsed });
        } catch (error) {
          observations.push({ source: worker.source, error: error.message });
        }
      }

      const decision = quorumDecision(observations);
      metrics.consensusRounds.push({ round, observations, decision });
      console.log(JSON.stringify({ phase: 'consensus', round, decision, observations: observations.map((o) => ({ source: o.source, venue: o.venue, price: o.price, capturedAt: o.capturedAt, elapsed: o.elapsed, error: o.error })) }));

      if (round <= 3) {
        assert.equal(decision.quorum, true, `expected quorum in round ${round}`);
        assert.ok(decision.sources.filter((source) => honestSources.has(source)).length >= 2, `honest quorum required in round ${round}`);
        if (observations.some((o) => o.source === 'adversary' && Number.isFinite(o.price))) {
          assert.ok(decision.outliers.includes('adversary'), `adversary should be rejected in round ${round}`);
          metrics.resilience.adversaryRejected = true;
        }
      }

      if (round === 3) await workerBySource.get('adversary').transport.close();

      if (round === 4) {
        assert.equal(decision.quorum, true, 'quorum should survive adversary failure');
        assert.ok(decision.sourceCount >= 2, 'at least two honest sources should remain in quorum');
        metrics.resilience.quorumSurvivedAdversaryFailure = true;
        await workerBySource.get('gate').transport.close();
      }

      if (round === 5) {
        assert.equal(decision.quorum, true, 'quorum should survive loss of one honest source');
        assert.ok(decision.sourceCount >= 2, 'two honest sources should still form quorum');
        await workerBySource.get('coinpaprika').transport.close();
      }

      if (round === 6) {
        assert.equal(decision.quorum, false, 'one remaining honest source must not form quorum');
        metrics.resilience.quorumFailureDetected = true;
        break;
      }
    }

    const rttWorker = workerBySource.get('coingecko');
    for (let i = 0; i < RTT_SAMPLES; i += 1) {
      const response = await rpc(coordinator, rttWorker.transport.addr, { type: 'ping.v1' });
      metrics.nknRttMs.push(response.elapsed);
    }
    metrics.centralRttMs = await centralHttpBaseline(RTT_SAMPLES);

    const report = {
      timestamp: new Date().toISOString(),
      symbol: SYMBOL,
      tolerance: TOLERANCE,
      maxObservationAgeMs: MAX_OBSERVATION_AGE_MS,
      rounds: metrics.consensusRounds.length,
      protocol: metrics.protocol,
      resilience: metrics.resilience,
      latencyMs: {
        nkn: { p50: percentile(metrics.nknRttMs, 50), p95: percentile(metrics.nknRttMs, 95), p99: percentile(metrics.nknRttMs, 99) },
        centralizedLocalHttp: { p50: percentile(metrics.centralRttMs, 50), p95: percentile(metrics.centralRttMs, 95), p99: percentile(metrics.centralRttMs, 99) },
      },
      consensus: metrics.consensusRounds,
    };

    assert.equal(metrics.protocol.packet, true);
    assert.equal(metrics.protocol.session, true);
    assert.equal(metrics.resilience.adversaryRejected, true);
    assert.equal(metrics.resilience.quorumSurvivedAdversaryFailure, true);
    assert.equal(metrics.resilience.quorumFailureDetected, true);

    console.log(JSON.stringify({ phase: 'result', report }, null, 2));
  } finally {
    await Promise.allSettled(workers.map((w) => w.transport.close()));
    await coordinator.close();
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ phase: 'failed', error: error.stack ?? error.message }));
  process.exitCode = 1;
});
