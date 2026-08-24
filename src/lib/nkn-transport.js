import nkn from 'nkn-sdk';

export async function createNknTransport({ identifier, numSubClients = 2, connectTimeoutMs = 45_000 } = {}) {
  const client = new nkn.MultiClient({
    identifier,
    numSubClients,
    originalClient: false,
    responseTimeout: 5000,
    reconnectIntervalMin: 1000,
    reconnectIntervalMax: 10000,
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
}
