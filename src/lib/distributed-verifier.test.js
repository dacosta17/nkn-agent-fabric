import assert from 'node:assert/strict';
import test from 'node:test';
import { createIdentity, signManifest } from './agent-trust.js';
import { createRound, createVerificationVote, verifyRoundEvidence } from './distributed-verifier.js';

function fixture() {
  const identities = ['a', 'b', 'c', 'd'].map(() => createIdentity());
  const participants = ['a', 'b', 'c', 'd'];
  const manifests = participants.map((agentId, i) => signManifest({ nknAddress: `nkn-${agentId}`, identity: identities[i], capabilities: ['verification'] }));
  const publicManifests = manifests.map((m, i) => ({ ...m, agentId: participants[i] }));
  return { identities, participants, manifests: publicManifests };
}

test('derives the same decision without coordinator output', () => {
  const { identities, participants, manifests } = fixture();
  const task = { type: 'market-observation.v1', symbol: 'NKN' };
  const round = createRound({ roundId: 'r-1', task, participants, quorum: 3 });
  const votes = participants.slice(0, 3).map((agentId, i) => createVerificationVote({ round, agentId, observationDigest: 'obs-1', outcome: 'accept', identity: identities[i] }));
  const result = verifyRoundEvidence({ round, votes, manifests });
  assert.equal(result.decision, 'accept');
  assert.equal(result.acceptedCount, 3);
  assert.equal(result.participatingCount, 3);
});

test('fails closed when the coordinator invents a vote', () => {
  const { identities, participants, manifests } = fixture();
  const round = createRound({ roundId: 'r-2', task: { value: 1 }, participants, quorum: 3 });
  const honest = participants.slice(0, 2).map((agentId, i) => createVerificationVote({ round, agentId, observationDigest: 'obs-2', outcome: 'accept', identity: identities[i] }));
  const forged = { ...honest[0], agentId: 'c' };
  const result = verifyRoundEvidence({ round, votes: [...honest, forged], manifests });
  assert.equal(result.decision, 'no-quorum');
  assert.ok(result.invalidVotes.some((reason) => reason.startsWith('c:invalid-signature-or-round')));
});

test('rejects duplicate votes from one participant', () => {
  const { identities, participants, manifests } = fixture();
  const round = createRound({ roundId: 'r-3', task: { value: 1 }, participants, quorum: 2 });
  const vote = createVerificationVote({ round, agentId: 'a', observationDigest: 'obs-3', outcome: 'accept', identity: identities[0] });
  const other = createVerificationVote({ round, agentId: 'b', observationDigest: 'obs-3', outcome: 'accept', identity: identities[1] });
  const result = verifyRoundEvidence({ round, votes: [vote, vote, other], manifests });
  assert.equal(result.decision, 'accept');
  assert.ok(result.invalidVotes.includes('a:duplicate'));
});

test('does not treat two conflicting votes as quorum', () => {
  const { identities, participants, manifests } = fixture();
  const round = createRound({ roundId: 'r-4', task: { value: 1 }, participants, quorum: 3 });
  const votes = [
    createVerificationVote({ round, agentId: 'a', observationDigest: 'obs-a', outcome: 'accept', identity: identities[0] }),
    createVerificationVote({ round, agentId: 'b', observationDigest: 'obs-b', outcome: 'reject', identity: identities[1] }),
    createVerificationVote({ round, agentId: 'c', observationDigest: 'obs-c', outcome: 'accept', identity: identities[2] }),
  ];
  const result = verifyRoundEvidence({ round, votes, manifests });
  assert.equal(result.decision, 'no-quorum');
});
