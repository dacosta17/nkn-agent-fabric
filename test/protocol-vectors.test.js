import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { digest, stableJson } from '../src/lib/canonical.js';

function load(name) {
  return JSON.parse(fs.readFileSync(new URL(`../vectors/${name}`, import.meta.url), 'utf8'));
}

test('protocol v1 canonical vector matches JS implementation', () => {
  const vector = load('protocol-v1-canonical.json');
  assert.equal(stableJson(vector.input), vector.canonical);
  assert.equal(digest(vector.input), vector.sha256);
});

test('protocol v1 Unicode vector matches JS implementation', () => {
  const vector = load('protocol-v1-unicode.json');
  assert.equal(stableJson(vector.input), vector.canonical);
  assert.equal(digest(vector.input), vector.sha256);
});
