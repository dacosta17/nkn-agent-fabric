function toText(value) {
  if (Buffer.isBuffer(value)) return value.toString('utf8');
  if (value instanceof ArrayBuffer) return Buffer.from(value).toString('utf8');
  if (ArrayBuffer.isView(value)) return Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString('utf8');
  return String(value);
}

function unwrapTransportEnvelope(value) {
  if (value === null || value === undefined) return value;
  if (Buffer.isBuffer(value) || value instanceof ArrayBuffer || ArrayBuffer.isView(value)) return value;
  if (typeof value !== 'object') return value;

  const keys = Object.keys(value);
  if (keys.length === 1 && keys[0] === 'data') return unwrapTransportEnvelope(value.data);
  if (keys.length === 1 && keys[0] === 'reply') return unwrapTransportEnvelope(value.reply);
  if (keys.length === 1 && keys[0] === 'payload') return unwrapTransportEnvelope(value.payload);
  return value;
}

export function decodeRpcReply(reply) {
  const unwrapped = unwrapTransportEnvelope(reply);
  if (unwrapped === null || unwrapped === undefined) return unwrapped;

  if (unwrapped && typeof unwrapped === 'object'
    && !ArrayBuffer.isView(unwrapped)
    && !(unwrapped instanceof ArrayBuffer)
    && !Buffer.isBuffer(unwrapped)) {
    return unwrapped;
  }

  const text = toText(unwrapped);
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`invalid NKN RPC response: ${error.message}`);
  }
}

export function rpcPayload(reply) {
  const decoded = decodeRpcReply(reply);
  if (!decoded || typeof decoded !== 'object') return undefined;
  return decoded.payload ?? decoded.data?.payload ?? decoded.reply?.payload ?? decoded;
}
