import nkn from 'nkn-sdk';

const DEFAULT_CONNECT_ATTEMPTS = 3;
const DEFAULT_CONNECT_BACKOFF_MS = 1500;
const DEFAULT_RESPONSE_TIMEOUT_MS = 7000;
const DEFAULT_OPERATION_ATTEMPTS = 3;
const DEFAULT_OPERATION_BACKOFF_MS = 1000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function createNknTransport({
  identifier,
  numSubClients = 2,
  connectTimeoutMs = 45_000,
  connectAttempts = Number(process.env.NKN_CONNECT_ATTEMPTS ?? DEFAULT_CONNECT_ATTEMPTS),
  connectBackoffMs = Number(process.env.NKN_CONNECT_BACKOFF_MS ?? DEFAULT_CONNECT_BACKOFF_MS),
  operationAttempts = Number(process.env.NKN_OPERATION_ATTEMPTS ?? DEFAULT_OPERATION_ATTEMPTS),
  operationBackoffMs = Number(process.env.NKN_OPERATION_BACKOFF_MS ?? DEFAULT_OPERATION_BACKOFF_MS),
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

      const originalSend = client.send.bind(client);
      client.send = async (...args) => {
        let operationError;
        for (let operationAttempt = 1; operationAttempt <= operationAttempts; operationAttempt += 1) {
          try {
            return await originalSend(...args);
          } catch (error) {
            operationError = error instanceof Error ? error : new Error(String(error));
            if (operationAttempt < operationAttempts) await sleep(operationBackoffMs * (2 ** (operationAttempt - 1)));
          }
        }
        throw operationError;
      };

      const originalDial = client.dial.bind(client);
      client.dial = async (...args) => {
        let operationError;
        for (let operationAttempt = 1; operationAttempt <= operationAttempts; operationAttempt += 1) {
          try {
            return await originalDial(...args);
          } catch (error) {
            operationError = error instanceof Error ? error : new Error(String(error));
            if (operationAttempt < operationAttempts) await sleep(operationBackoffMs * (2 ** (operationAttempt - 1)));
          }
        }
        throw operationError;
      };

      return client;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (client) await Promise.resolve(client.close()).catch(() => {});
      if (attempt < connectAttempts) await sleep(connectBackoffMs * (2 ** (attempt - 1)));
    }
  }

  throw new Error(`NKN connection failed after ${connectAttempts} attempts: ${lastError?.message ?? 'unknown error'}`);
}
