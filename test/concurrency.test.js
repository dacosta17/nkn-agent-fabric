import assert from 'node:assert/strict';
import test from 'node:test';
import { mapConcurrent } from '../src/lib/concurrency.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test('mapConcurrent preserves input order while running work in parallel', async () => {
  const started = [];
  const result = await mapConcurrent([1, 2, 3, 4], async (value) => {
    started.push(value);
    await sleep(20);
    return value * 2;
  }, 4);
  assert.deepEqual(result, [2, 4, 6, 8]);
  assert.deepEqual(started.sort((a, b) => a - b), [1, 2, 3, 4]);
});

test('mapConcurrent enforces concurrency limit', async () => {
  let active = 0;
  let peak = 0;
  const result = await mapConcurrent([1, 2, 3, 4, 5], async (value) => {
    active += 1;
    peak = Math.max(peak, active);
    await sleep(10);
    active -= 1;
    return value;
  }, 2);
  assert.deepEqual(result, [1, 2, 3, 4, 5]);
  assert.equal(peak, 2);
});

test('mapConcurrent rejects invalid concurrency', async () => {
  await assert.rejects(() => mapConcurrent([1], async (x) => x, 0), /positive integer/);
  await assert.rejects(() => mapConcurrent([1], async (x) => x, 1.5), /positive integer/);
});
