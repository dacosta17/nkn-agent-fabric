import { digest, stableJson } from './canonical.js';
import { verifySignedObject } from './agent-trust.js';

export const DISTRIBUTED_ROUND_VERSION = 1;

export function createRound({ roundId, task, participants, quorum }) {
  if (!roundId || !task || !Array.isArray(participants) || participants.length === 0) throw new Error('invalid verification round');
  if (!Number.isInteger(quorum) || quorum < 1 || quorum > participants.length) throw new Error('invalid quorum');
  const participantIds = [...new Set(participants)].sort();
  if (participantIds.length !== participants.length) throw new Error('duplicate participants');
  return { version: DISTRIBUTED_ROUND_VERSION, roundId, taskDigest: digest(task), participants: participantIds, quorum };
}

export function createVerificationVote({ round, agentId, observationDigest, outcome, identity, createdAt = Date.now(), ttlMs = 60_000 }) {
  if (!round || !round.roundId || !round.taskDigest) throw new Error('round is required');
  if (!round.participants.includes(agentId)) throw new Error('agent is not a participant');
  if (!observationDigest || !['accept', 'reject'].includes(outcome)) throw new Error('invalid verification vote');
  return signObject({
    version: DISTRIBUTED_ROUND_VERSION,
    type: 'verification-vote.v1',
    roundId: round.roundId,
    taskDigest: round.taskDigest,
    agentId,
    observationDigest,
    outcome,
    createdAt,
    expiresAt: createdAt + ttlMs,
  }, identity);
}

function signObject(object, identity) {
  const { sign } = requireCrypto();
  const signature = sign(null, Buffer.from(stableJson(object)), identity.privateKey);
  return { ...object, signature: Buffer.from(signature).toString('base64') };
}

function requireCrypto() {
  // Kept isolated so the protocol object remains a plain serializable value.
  return require('node:crypto');
}

export function verifyRoundEvidence({ round, votes, manifests = [], now = Date.now() }) {
  if (!round || round.version !== DISTRIBUTED_ROUND_VERSION) return invalid('invalid-round');
  if (!Array.isArray(votes)) return invalid('invalid-votes');
  const manifestByAgent = new Map(manifests.map((m) => [m.agentId, m]));
  const seenAgents = new Set();
  const accepted = [];
  const rejected = [];
  const invalidVotes = [];

  for (const vote of votes) {
    if (!vote || vote.type !== 'verification-vote.v1') { invalidVotes.push('malformed'); continue; }
    if (!round.participants.includes(vote.agentId)) { invalidVotes.push(`${vote.agentId}:not-participant`); continue; }
    if (seenAgents.has(vote.agentId)) { invalidVotes.push(`${vote.agentId}:duplicate`); continue; }
    const manifest = manifestByAgent.get(vote.agentId);
    if (!manifest?.publicKey) { invalidVotes.push(`${vote.agentId}:missing-identity`); continue; }
    const verified = verifySignedObject(vote, manifest.publicKey, { now });
    if (!verified.valid || vote.roundId !== round.roundId || vote.taskDigest !== round.taskDigest) {
      invalidVotes.push(`${vote.agentId}:invalid-signature-or-round`);
      continue;
    }
    seenAgents.add(vote.agentId);
    (vote.outcome === 'accept' ? accepted : rejected).push(vote);
  }

  const decision = accepted.length >= round.quorum ? 'accept' : rejected.length >= round.quorum ? 'reject' : 'no-quorum';
  return { valid: decision !== 'no-quorum', decision, acceptedCount: accepted.length, rejectedCount: rejected.length, participatingCount: seenAgents.size, invalidVotes, evidenceDigest: digest({ round, votes: votes.filter((v) => seenAgents.has(v?.agentId)) }) };
}

function invalid(reason) { return { valid: false, decision: 'no-quorum', acceptedCount: 0, rejectedCount: 0, participatingCount: 0, invalidVotes: [reason] }; }
