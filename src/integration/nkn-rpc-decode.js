function toText(value) {
  if (Buffer.isBuffer(value)) return value.toString('utf8');
  if (value instanceof ArrayBuffer) return Buffer.from(value).toString('utf8');
  if (ArrayBuffer.isView(value)) return Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString('utf8');
  return String(value);
}

export function decodeRpcReply(reply) {
  if (reply === null || reply === undefined) return reply;

  if (reply && typeof reply === 'object' && !ArrayBuffer.isView(reply) && !(reply instanceof ArrayBuffer)) {
    // Different nkn-sdk-js versions/runtime adapters can wrap ReplyData.
    // Normalize the common `{data: ...}` / `{reply: ...}` wrappers before
    // exposing the protocol envelope to the integration test.
    if ('data' in reply && Object.keys(reply).length <= 3) return decodeRpcReply(reply.data);
    if ('reply' in reply && Object.keys(reply).length <= 3) return decodeRpcReply(reply.reply);
    return reply;
  }

  const text = toText(reply);
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`invalid NKN RPC response: ${error.message}`);
  }
}
