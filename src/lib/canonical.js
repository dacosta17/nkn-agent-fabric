import { createHash } from 'node:crypto';

function compareUtf8(a, b) {
  return Buffer.from(a, 'utf8').compare(Buffer.from(b, 'utf8'));
}

export function stableJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  return `{${Object.keys(value).sort(compareUtf8).map((k) => `${JSON.stringify(k)}:${stableJson(value[k])}`).join(',')}}`;
}

export function digest(value) {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}
