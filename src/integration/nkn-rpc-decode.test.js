import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeRpcReply, rpcPayload } from './nkn-rpc-decode.js';

test('normalizes direct protocol envelope', () => {
  const reply = { payload: { result: { ok: true } } };
  assert.deepEqual(decodeRpcReply(reply), { result: { ok: true } });
  assert.deepEqual(rpcPayload(reply), { result: { ok: true } });
});

test('normalizes sdk data wrapper', () => {
  assert.deepEqual(rpcPayload({ data: { payload: { result: { ok: true } } } }), { result: { ok: true } });
});

test('normalizes sdk reply wrapper', () => {
  assert.deepEqual(rpcPayload({ reply: { payload: { result: { ok: true } } } }), { result: { ok: true } });
});

test('normalizes byte encoded JSON', () => {
  const encoded = Buffer.from(JSON.stringify({ payload: { result: { ok: true } } }));
  assert.deepEqual(rpcPayload(encoded), { result: { ok: true } });
});

test('does not unwrap arbitrary application objects', () => {
  const value = { payload: { result: { ok: true } }, metadata: { source: 'nkn' } };
  assert.deepEqual(decodeRpcReply(value), value);
});
