import assert from 'node:assert/strict';
import test from 'node:test';
import { createIdentity, signManifest } from './agent-trust.js';
import { createRound, createVerificationVote, verifyRoundEvidence } from './distributed-verifier.js';

function fixture() {
  const agents = ['a', 'b', 'c', 'd'];
  const identities = Object.fromEntries(agents.map((agent) => [agent, createIdentity()]));
  const manifests = agents.map((agent) => ({ ...signManifest({ nknAddress: agent, identity: identities[agent], capabilities: ['verification'] }), agentId: agent }));
  return { agents, identities, manifests };
}

test('an independent verifier can derive quorum without coordinator output', () => {
  const { agents, identities, manifests } = fixture();
  const round = createRound({ roundId: 'round-1', task: { type: 'market-observation.v1', symbol: 'NKN' }, participants: agents, quorum: 3 });
  const votes = agents.slice(0, 3).map((agent) => createVerificationVote({ round, agentId: agent, observationDigest: 'obs-1', outcome: 'accept', identity: identities[agent] }));
  const result = verifyRoundEvidence({ round, votes, manifests });
  assert.equal(result.decision, 'accept');
  assert.equal(result.acceptedCount, 3);
  assert.equal(result.participatingCount, 3);
  assert.ok(result.evidenceDigest);
});

test('votes are cryptographically bound to the exact round policy', () => {
  const { agents, identities, manifests } = fixture();
  const round = createRound({ roundId: 'round-policy', task: { value: 1 }, participants: agents, quorum: 3 });
  const votes = agents.slice(0, 3).map((agent) => createVerificationVote({ round, agentId: agent, observationDigest: 'obs-policy', outcome: 'accept', identity: identities[agent] }));
  const mutatedRound = { ...round, quorum: 2 };
  const result = verifyRoundEvidence({ round: mutatedRound, votes, manifests });
  assert.equal(result.decision, 'no-quorum');
  assert.deepEqual(result.invalidVotes, ['invalid-round-digest']);
});

test('a coordinator cannot forge quorum by changing a signer identity', () => {
  const { agents, identities, manifests } = fixture();
  const round = createRound({ roundId: 'round-2', task: { value: 1 }, participants: agents, quorum: 3 });
  const votes = agents.slice(0, 2).map((agent) => createVerificationVote({ round, agentId: agent, observationDigest: 'obs-2', outcome: 'accept', identity: identities[agent] }));
  const forged = { ...votes[0], agentId: 'c' };
  const result = verifyRoundEvidence({ round, votes: [...votes, forged], manifests });
  assert.equal(result.decision, 'no-quorum');
  assert.ok(result.invalidVotes.includes('c:invalid-signature-or-round'));
});

test('duplicate votes do not increase participant weight', () => {
  const { agents, identities, manifests } = fixture();
  const round = createRound({ roundId: 'round-3', task: { value: 1 }, participants: agents, quorum: 2 });
  const voteA = createVerificationVote({ round, agentId: 'a', observationDigest: 'obs-3', outcome: 'accept', identity: identities.a });
  const voteB = createVerificationVote({ round, agentId: 'b', observationDigest: 'obs-3', outcome: 'accept', identity: identities.b });
  const result = verifyRoundEvidence({ round, votes: [voteA, voteA, voteB], manifests });
  assert.equal(result.decision, 'accept');
  assert.ok(result.invalidVotes.includes('a:duplicate'));
});

test('conflicting observations cannot be aggregated into a false quorum', () => {
  const { agents, identities, manifests } = fixture();
  const round = createRound({ roundId: 'round-4', task: { value: 1 }, participants: agents, quorum: 2 });
  const votes = [
    createVerificationVote({ round, agentId: 'a', observationDigest: 'obs-a', outcome: 'accept', identity: identities.a }),
    createVerificationVote({ round, agentId: 'b', observationDigest: 'obs-b', outcome: 'accept', identity: identities.b }),
    createVerificationVote({ round, agentId: 'c', observationDigest: 'obs-c', outcome: 'accept', identity: identities.c }),
  ];
  const result = verifyRoundEvidence({ round, votes, manifests });
  assert.equal(result.decision, 'no-quorum');
  assert.equal(result.acceptedCount, 3);
  assert.equal(result.participatingCount, 3);
});

test('a common claim can reach quorum even when another participant disagrees', () => {
  const { agents, identities, manifests } = fixture();
  const round = createRound({ roundId: 'round-5', task: { value: 1 }, participants: agents, quorum: 3 });
  const votes = [
    createVerificationVote({ round, agentId: 'a', observationDigest: 'obs-common', outcome: 'accept', identity: identities.a }),
    createVerificationVote({ round, agentId: 'b', observationDigest: 'obs-common', outcome: 'accept', identity: identities.b }),
    createVerificationVote({ round, agentId: 'c', observationDigest: 'obs-common', outcome: 'accept', identity: identities.c }),
    createVerificationVote({ round, agentId: 'd', observationDigest: 'obs-other', outcome: 'accept', identity: identities.d }),
  ];
  const result = verifyRoundEvidence({ round, votes, manifests });
  assert.equal(result.decision, 'accept');
  assert.equal(result.acceptedCount, 4);
});
