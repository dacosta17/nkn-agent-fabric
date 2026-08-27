import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, statSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { loadOrCreatePersistentIdentity } from './persistent-identity.js';

test('persistent identity survives reload with the same application and NKN identities', () => {
  const dir = mkdtempSync(join(tmpdir(), 'nkn-agent-identity-'));
  const filePath = join(dir, 'operator.json');
  try {
    const first = loadOrCreatePersistentIdentity({ filePath, passphrase: 'correct horse battery staple' });
    const second = loadOrCreatePersistentIdentity({ filePath, passphrase: 'correct horse battery staple' });
    assert.equal(second.identity.publicKeyB64, first.identity.publicKeyB64);
    assert.equal(second.nknSeed, first.nknSeed);
    assert.equal(second.operatorFingerprint, first.operatorFingerprint);
    assert.equal(statSync(filePath).mode & 0o777, 0o600);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('wrong passphrase fails closed', () => {
  const dir = mkdtempSync(join(tmpdir(), 'nkn-agent-identity-'));
  const filePath = join(dir, 'operator.json');
  try {
    loadOrCreatePersistentIdentity({ filePath, passphrase: 'correct horse battery staple' });
    assert.throws(() => loadOrCreatePersistentIdentity({ filePath, passphrase: 'wrong passphrase' }), /cannot load operator identity/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('tampering with the encrypted record fails closed', () => {
  const dir = mkdtempSync(join(tmpdir(), 'nkn-agent-identity-'));
  const filePath = join(dir, 'operator.json');
  try {
    loadOrCreatePersistentIdentity({ filePath, passphrase: 'correct horse battery staple' });
    const record = JSON.parse(readFileSync(filePath, 'utf8'));
    const data = Buffer.from(record.cipher.data, 'base64');
    data[0] ^= 0xff;
    record.cipher.data = data.toString('base64');
    writeFileSync(filePath, `${JSON.stringify(record)}\n`, { mode: 0o600 });
    assert.throws(() => loadOrCreatePersistentIdentity({ filePath, passphrase: 'correct horse battery staple' }), /cannot load operator identity/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
