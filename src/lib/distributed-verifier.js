import { sign } from 'node:crypto';
import { digest, stableJson } from './canonical.js';
import { verifySignedObject } from './agent-trust.js';

export const DISTRIBUTED_ROUND_VERSION = 1;

export function createRound({ roundId, task, participants, quorum }) {
  if (!roundId || !task || !Array.isArray(participants) || participants.length === 0) throw new Error('invalid verification round');
  if (!Number.isInteger(quorum) || quorum < 1 || quorum > participants.length) throw new Error('invalid quorum');
  const ids = [...new Set(participants)].sort();
  if (ids.length !== participants.length) throw new Error('duplicate participants');

  const round = {
    version: DISTRIBUTED_ROUND_VERSION,
    roundId,
    taskDigest: digest(task),
    participants: ids,
    quorum,
  };
  return { ...round, roundDigest: digest(round) };
}

export function createVerificationVote({ round, agentId, observationDigest, outcome, identity, createdAt = Date.now(), ttlMs = 60_000 }) {
  if (!round?.roundId || !round.taskDigest || !round?.roundDigest) throw new Error('round is required');
  if (!round.participants.includes(agentId)) throw new Error('agent is not a participant');
  if (!observationDigest || !['accept', 'reject'].includes(outcome)) throw new Error('invalid verification vote');
  const unsigned = {
    version: DISTRIBUTED_ROUND_VERSION,
    type: 'verification-vote.v1',
    roundId: round.roundId,
    roundDigest: round.roundDigest,
    taskDigest: round.taskDigest,
    agentId,
    observationDigest,
    outcome,
    createdAt,
    expiresAt: createdAt + ttlMs,
  };
  return { ...unsigned, signature: Buffer.from(sign(null, Buffer.from(stableJson(unsigned)), identity.privateKey)).toString('base64') };
}

export function verifyRoundEvidence({ round, votes, manifests = [], now = Date.now() }) {
  if (!round || round.version !== DISTRIBUTED_ROUND_VERSION || !round.roundDigest) return invalid('invalid-round');
  if (digest({ version: round.version, roundId: round.roundId, taskDigest: round.taskDigest, participants: round.participants, quorum: round.quorum }) !== round.roundDigest) return invalid('invalid-round-digest');
  if (!Array.isArray(votes)) return invalid('invalid-votes');

  const byAgent = new Map(manifests.map((manifest) => [manifest.agentId, manifest]));
  const seen = new Set();
  const validVotes = [];
  const invalidVotes = [];

  for (const vote of votes) {
    if (!vote || vote.type !== 'verification-vote.v1') { invalidVotes.push('malformed'); continue; }
    if (!round.participants.includes(vote.agentId)) { invalidVotes.push(`${vote.agentId}:not-participant`); continue; }
    if (seen.has(vote.agentId)) { invalidVotes.push(`${vote.agentId}:duplicate`); continue; }
    const manifest = byAgent.get(vote.agentId);
    if (!manifest?.publicKey) { invalidVotes.push(`${vote.agentId}:missing-identity`); continue; }
    const verified = verifySignedObject(vote, manifest.publicKey, { now });
    if (!verified.valid || vote.roundId !== round.roundId || vote.roundDigest !== round.roundDigest || vote.taskDigest !== round.taskDigest) {
      invalidVotes.push(`${vote.agentId}:invalid-signature-or-round`);
      continue;
    }
    seen.add(vote.agentId);
    validVotes.push(vote);
  }

  const claimCounts = new Map();
  for (const vote of validVotes) {
    const claimKey = `${vote.outcome}:${vote.observationDigest}`;
    claimCounts.set(claimKey, (claimCounts.get(claimKey) ?? 0) + 1);
  }

  const winningClaims = [...claimCounts.entries()].filter(([, count]) => count >= round.quorum);
  const decision = winningClaims.length === 1
    ? winningClaims[0][0].split(':', 1)[0]
    : 'no-quorum';

  const acceptedCount = validVotes.filter((vote) => vote.outcome === 'accept').length;
  const rejectedCount = validVotes.filter((vote) => vote.outcome === 'reject').length;
  const canonicalVotes = [...validVotes].sort((a, b) => a.agentId.localeCompare(b.agentId));

  return {
    valid: decision !== 'no-quorum',
    decision,
    acceptedCount,
    rejectedCount,
    participatingCount: seen.size,
    invalidVotes,
    evidenceDigest: digest({ round, votes: canonicalVotes }),
  };
}

function invalid(reason) {
  return { valid: false, decision: 'no-quorum', acceptedCount: 0, rejectedCount: 0, participatingCount: 0, invalidVotes: [reason] };
}
