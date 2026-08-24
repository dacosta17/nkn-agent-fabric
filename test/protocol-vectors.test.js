import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { digest, stableJson } from '../src/lib/canonical.js';

const vector = JSON.parse(fs.readFileSync(new URL('../vectors/protocol-v1-canonical.json', import.meta.url), 'utf8'));

test('protocol v1 canonical vector matches JS implementation', () => {
  assert.equal(stableJson(vector.input), vector.canonical);
  assert.equal(digest(vector.input), vector.sha256);
});
