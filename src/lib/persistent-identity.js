import { chmodSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createCipheriv, createDecipheriv, createHash, createPrivateKey, createPublicKey, randomBytes, scryptSync } from 'node:crypto';
import { createIdentity } from './agent-trust.js';

const VERSION = 1;
const KDF_N = 16384;
const KDF_R = 8;
const KDF_P = 1;
const KEY_BYTES = 32;
const IV_BYTES = 12;
const SALT_BYTES = 16;

function deriveKey(passphrase, salt) {
  if (typeof passphrase !== 'string' || passphrase.length < 12) throw new Error('identity passphrase must be at least 12 characters');
  return scryptSync(passphrase, salt, KEY_BYTES, { N: KDF_N, r: KDF_R, p: KDF_P, maxmem: 64 * 1024 * 1024 });
}

function encodePrivateKey(identity) {
  return identity.privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64');
}

function createIdentityFromPrivateKey(privateKeyB64) {
  const privateKey = createPrivateKey({ key: Buffer.from(privateKeyB64, 'base64'), type: 'pkcs8', format: 'der' });
  const publicKey = createPublicKey(privateKey);
  return { privateKey, publicKey, publicKeyB64: publicKey.export({ type: 'spki', format: 'der' }).toString('base64') };
}

function fingerprint(publicKeyB64) {
  return createHash('sha256').update(Buffer.from(publicKeyB64, 'base64')).digest('hex');
}

function decryptRecord(record, passphrase) {
  if (record?.version !== VERSION || record?.kdf?.name !== 'scrypt' || record?.cipher?.name !== 'aes-256-gcm') throw new Error('unsupported persisted identity format');
  const salt = Buffer.from(record.kdf.salt, 'base64');
  const iv = Buffer.from(record.cipher.iv, 'base64');
  const tag = Buffer.from(record.cipher.tag, 'base64');
  const key = deriveKey(passphrase, salt);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(Buffer.from(record.cipher.data, 'base64')), decipher.final()]);
  const payload = JSON.parse(plaintext.toString('utf8'));
  if (payload.version !== VERSION || !payload.nknSeed || !payload.privateKey || !payload.publicKeyB64) throw new Error('invalid persisted identity payload');
  const identity = createIdentityFromPrivateKey(payload.privateKey);
  if (identity.publicKeyB64 !== payload.publicKeyB64) throw new Error('persisted identity public key mismatch');
  return { identity, nknSeed: payload.nknSeed, operatorFingerprint: fingerprint(payload.publicKeyB64) };
}

function encryptPayload(payload, passphrase) {
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const key = deriveKey(passphrase, salt);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(Buffer.from(JSON.stringify(payload), 'utf8')), cipher.final()]);
  return {
    version: VERSION,
    kdf: { name: 'scrypt', n: KDF_N, r: KDF_R, p: KDF_P, salt: salt.toString('base64') },
    cipher: { name: 'aes-256-gcm', iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: ciphertext.toString('base64') },
  };
}

export function loadOrCreatePersistentIdentity({ filePath, passphrase }) {
  if (!filePath) throw new Error('identity file path is required');
  try {
    return decryptRecord(JSON.parse(readFileSync(filePath, 'utf8')), passphrase);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw new Error(`cannot load operator identity: ${error.message}`);
    const identity = createIdentity();
    const nknSeed = randomBytes(32).toString('hex');
    const payload = { version: VERSION, nknSeed, publicKeyB64: identity.publicKeyB64, privateKey: encodePrivateKey(identity) };
    const record = encryptPayload(payload, passphrase);
    mkdirSync(dirname(filePath), { recursive: true, mode: 0o700 });
    const temporaryPath = `${filePath}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`;
    writeFileSync(temporaryPath, `${JSON.stringify(record)}\n`, { mode: 0o600, flag: 'wx' });
    chmodSync(temporaryPath, 0o600);
    renameSync(temporaryPath, filePath);
    return { identity, nknSeed, operatorFingerprint: fingerprint(identity.publicKeyB64) };
  }
}
