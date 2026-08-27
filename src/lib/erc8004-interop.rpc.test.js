import assert from 'node:assert/strict';
import test from 'node:test';
import { readIdentityRegistry, resolveAndVerifyOnChainAgent } from './erc8004-interop.js';

const registry = '0x8004a6090Cd10A7288092483047B097295Fb8847';
const agentURI = 'https://example.test/agent.json';
const owner = '0x1111111111111111111111111111111111111111';

function encodeString(value) {
  const data = Buffer.from(value, 'utf8');
  const padded = Buffer.concat([data, Buffer.alloc((32 - (data.length % 32)) % 32)]);
  return `0x${Buffer.concat([Buffer.alloc(31), Buffer.from([32]), Buffer.alloc(31), Buffer.from([data.length]), padded]).toString('hex')}`;
}
function encodeAddress(address) {
  return `0x${Buffer.alloc(12).toString('hex')}${address.slice(2).toLowerCase()}`;
}

function mockFetch(_url, options) {
  const body = JSON.parse(options.body);
  const isTokenUri = body.params[0].data.startsWith('0xc87b56dd');
  return Promise.resolve({ ok: true, json: async () => ({ jsonrpc: '2.0', id: body.id, result: isTokenUri ? encodeString(agentURI) : encodeAddress(owner) }) });
}

test('reads ERC-8004 tokenURI and ownerOf using JSON-RPC without an EVM dependency', async () => {
  const result = await readIdentityRegistry({ rpcUrl: 'https://rpc.example', identityRegistry: registry, agentId: 42, fetchImpl: mockFetch });
  assert.equal(result.agentURI, agentURI);
  assert.equal(result.owner, owner);
});

test('rejects an on-chain registration whose resolved file does not reference the same identity', async () => {
  const registration = {
    type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
    name: 'Agent', description: 'Test', image: '',
    services: [{ name: 'NKN', endpoint: 'agent.key', version: '1' }],
    registrations: [{ agentRegistry: `eip155:11155111:${registry}`, agentId: 41 }],
  };
  const result = await resolveAndVerifyOnChainAgent({ rpcUrl: 'https://rpc.example', agentRegistry: `eip155:11155111:${registry}`, agentId: 42, registration, fetchImpl: mockFetch });
  assert.equal(result.valid, false);
  assert.equal(result.reason, 'on-chain-registration-reference-mismatch');
});
