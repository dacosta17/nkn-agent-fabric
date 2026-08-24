import nkn from 'nkn-sdk';

const DEFAULT_CONNECT_ATTEMPTS = 3;
const DEFAULT_CONNECT_BACKOFF_MS = 1500;
const DEFAULT_RESPONSE_TIMEOUT_MS = 7000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function createNknTransport({
  identifier,
  numSubClients = 2,
  connectTimeoutMs = 45_000,
  connectAttempts = Number(process.env.NKN_CONNECT_ATTEMPTS ?? DEFAULT_CONNECT_ATTEMPTS),
  connectBackoffMs = Number(process.env.NKN_CONNECT_BACKOFF_MS ?? DEFAULT_CONNECT_BACKOFF_MS),
  responseTimeoutMs = Number(process.env.NKN_RESPONSE_TIMEOUT_MS ?? DEFAULT_RESPONSE_TIMEOUT_MS),
  rpcServerAddr = process.env.NKN_RPC_SERVER_ADDR,
} = {}) {
  let lastError;

  for (let attempt = 1; attempt <= connectAttempts; attempt += 1) {
    let client;
    try {
      client = new nkn.MultiClient({
        identifier,
        numSubClients,
        originalClient: false,
        responseTimeout: responseTimeoutMs,
        reconnectIntervalMin: 1000,
        reconnectIntervalMax: 10000,
        ...(rpcServerAddr ? { rpcServerAddr } : {}),
      });

      await new Promise((resolve, reject) => {
        let settled = false;
        const finish = (fn, value) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          fn(value);
        };
        const timeout = setTimeout(() => {
          void client.close();
          finish(reject, new Error(`NKN connect timeout after ${connectTimeoutMs}ms`));
        }, connectTimeoutMs);

        client.onConnect(() => finish(resolve));
        client.onConnectFailed((error) => finish(reject, error instanceof Error ? error : new Error(String(error))));
      });

      return client;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (client) await Promise.resolve(client.close()).catch(() => {});
      if (attempt < connectAttempts) await sleep(connectBackoffMs * (2 ** (attempt - 1)));
    }
  }

  throw new Error(`NKN connection failed after ${connectAttempts} attempts: ${lastError?.message ?? 'unknown error'}`);
}
