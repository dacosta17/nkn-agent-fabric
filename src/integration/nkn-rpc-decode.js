export function decodeRpcReply(reply) {
  if (reply && typeof reply === 'object' && !ArrayBuffer.isView(reply) && !(reply instanceof ArrayBuffer)) return reply;
  const text = Buffer.isBuffer(reply)
    ? reply.toString('utf8')
    : reply instanceof ArrayBuffer
      ? Buffer.from(reply).toString('utf8')
      : ArrayBuffer.isView(reply)
        ? Buffer.from(reply.buffer, reply.byteOffset, reply.byteLength).toString('utf8')
        : String(reply);
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`invalid NKN RPC response: ${error.message}`);
  }
}
