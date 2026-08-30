#!/usr/bin/env node

/**
 * Crypto Earning Opportunity Scanner
 *
 * Read-only by default. It discovers funded/claimable digital-work
 * opportunities that an agent can potentially execute, then ranks them by
 * expected value. It does NOT sign transactions, exploit live systems, or
 * move funds.
 */

const DEFAULT_AGENT_BOUNTIES =
  'https://api.agentbounties.app/v1/base/autonomous-bounties/feed?network=base-mainnet&claimable_only=true';
const DEFAULT_GITHUB_SEARCH =
  'https://api.github.com/search/issues?q=' +
  encodeURIComponent('is:open (bounty OR reward OR paid) label:bounty') +
  '&per_page=30';

const asNumber = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const match = value.replaceAll(',', '').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
};

const pick = (object, paths) => {
  for (const path of paths) {
    let cursor = object;
    for (const part of path.split('.')) {
      if (cursor == null) break;
      cursor = cursor[part];
    }
    if (cursor !== undefined && cursor !== null) return cursor;
  }
  return null;
};

const toArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  for (const key of ['items', 'results', 'bounties', 'opportunities', 'data']) {
    if (Array.isArray(payload?.[key])) return payload[key];
  }
  return [];
};

const normalizeAgentBounty = (item) => {
  const reward = asNumber(pick(item, [
    'solver_reward_usdc',
    'solver_reward',
    'reward_usdc',
    'reward',
    'amount_usdc',
    'amount',
  ]));
  const title = pick(item, ['title', 'name', 'bounty_title', 'description']) || 'Untitled bounty';
  const url = pick(item, ['url', 'canonical_url', 'bounty_url', 'source_url']) || 'https://agentbounties.app/';
  const funded = Boolean(pick(item, ['funded', 'is_funded'])) ||
    Number(pick(item, ['funding.usdc', 'funding_amount_usdc']) || 0) > 0;
  const verificationReady = Boolean(pick(item, ['verification_ready', 'verifier_ready', 'verification.ready']));
  const claimable = Boolean(pick(item, ['claimable', 'is_claimable', 'lifecycle']) === true ||
    pick(item, ['lifecycle', 'status']) === 'ready_to_earn' ||
    pick(item, ['status']) === 'claimable');
  const bond = asNumber(pick(item, ['claim_bond_usdc', 'bond_usdc', 'claim_bond', 'bond'])) || 0;
  const externalSpend = asNumber(pick(item, ['required_external_spend_usdc', 'external_spend_usdc'])) || 0;

  return {
    source: 'agent-bounties',
    title: String(title).slice(0, 180),
    url,
    rewardUsd: reward,
    capitalUsd: bond + externalSpend,
    funded,
    verificationReady,
    claimable,
    raw: item,
  };
};

const normalizeGithubIssue = (item) => {
  const body = String(item.body || '');
  const combined = `${item.title || ''} ${body}`;
  const rewardMatch = combined.match(/(?:\$|USD\s*)(\d{2,6}(?:\.\d{1,2})?)/i);
  const rewardUsd = rewardMatch ? Number(rewardMatch[1]) : null;
  return {
    source: 'github-bounty',
    title: item.title || 'GitHub bounty',
    url: item.html_url,
    rewardUsd,
    capitalUsd: 0,
    funded: rewardUsd !== null,
    verificationReady: true,
    claimable: true,
    raw: item,
  };
};

const scoreOpportunity = (item) => {
  if (!item.rewardUsd || item.rewardUsd <= 0) return { ...item, score: 0, verdict: 'reject:no-visible-reward' };

  // Conservative, transparent first-pass economics.
  // We deliberately discount unknown effort and unknown acceptance probability.
  const assumedHours = item.source === 'agent-bounties' ? 1.5 : 2.5;
  const assumedHourlyValue = 50;
  const effortCost = assumedHours * assumedHourlyValue;
  const capitalCost = item.capitalUsd || 0;
  const grossEdge = item.rewardUsd - capitalCost - effortCost;
  const readinessMultiplier = item.source === 'agent-bounties'
    ? (item.claimable && item.funded && item.verificationReady ? 1 : 0.25)
    : 0.35;
  const score = Math.round(grossEdge * readinessMultiplier * 100) / 100;

  let verdict = 'watch';
  if (score >= 100) verdict = 'execute-candidate';
  else if (score >= 25) verdict = 'review';
  else if (score <= 0) verdict = 'reject:negative-ev';

  return { ...item, score, verdict };
};

const fetchJson = async (url, headers = {}) => {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'nkn-agent-fabric/earning-scanner',
      accept: 'application/json',
      ...headers,
    },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${url}`);
  return response.json();
};

const scan = async () => {
  const errors = [];
  const opportunities = [];

  try {
    const payload = await fetchJson(process.env.AGENT_BOUNTIES_FEED_URL || DEFAULT_AGENT_BOUNTIES);
    opportunities.push(...toArray(payload).map(normalizeAgentBounty));
  } catch (error) {
    errors.push(`agent-bounties: ${error.message}`);
  }

  try {
    const payload = await fetchJson(
      process.env.GITHUB_BOUNTY_SEARCH_URL || DEFAULT_GITHUB_SEARCH,
      process.env.GITHUB_TOKEN ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {},
    );
    opportunities.push(...(payload.items || []).map(normalizeGithubIssue));
  } catch (error) {
    errors.push(`github: ${error.message}`);
  }

  return {
    generatedAt: new Date().toISOString(),
    policy: {
      mode: 'read-only-discovery',
      noLiveExploitation: true,
      noTransactionSigning: true,
      noFundMovement: true,
    },
    opportunities: opportunities.map(scoreOpportunity).sort((a, b) => b.score - a.score),
    errors,
  };
};

const main = async () => {
  const report = await scan();
  const outPath = process.env.EARNING_REPORT_PATH || 'earning-opportunities.json';
  const fs = await import('node:fs/promises');
  await fs.writeFile(outPath, JSON.stringify(report, null, 2) + '\n');

  console.log(`Scanned ${report.opportunities.length} opportunities`);
  for (const item of report.opportunities.slice(0, 10)) {
    console.log(`${item.verdict.padEnd(24)} $${item.rewardUsd ?? '?'} | $${item.capitalUsd.toFixed(2)} capital | ${item.title}`);
    console.log(`  ${item.url}`);
  }
  if (report.errors.length) {
    console.error('Scanner errors:');
    for (const error of report.errors) console.error(`- ${error}`);
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
