import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeRpcReply, rpcResult } from './nkn-rpc-decode.js';

test('normalizes direct protocol envelope', () => {
  const reply = { result: { ok: true } };
  assert.deepEqual(decodeRpcReply(reply), reply);
  assert.deepEqual(rpcResult(reply), { ok: true });
});

test('normalizes sdk data wrapper', () => {
  assert.deepEqual(rpcResult({ data: { result: { ok: true } } }), { ok: true });
});

test('normalizes sdk reply wrapper', () => {
  assert.deepEqual(rpcResult({ reply: { payload: { result: { ok: true } } } }), { ok: true });
});

test('normalizes byte encoded JSON', () => {
  const encoded = Buffer.from(JSON.stringify({ result: { ok: true } }));
  assert.deepEqual(rpcResult(encoded), { ok: true });
});

test('does not unwrap arbitrary application objects', () => {
  const value = { payload: { result: { ok: true } }, metadata: { source: 'nkn' } };
  assert.deepEqual(decodeRpcReply(value), value);
});
