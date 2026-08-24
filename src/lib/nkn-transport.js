import nkn from 'nkn-sdk';

export async function createNknTransport({ identifier, numSubClients = 4 } = {}) {
  const client = new nkn.MultiClient({
    identifier,
    numSubClients,
    originalClient: false,
    responseTimeout: 5000,
    reconnectIntervalMin: 1000,
    reconnectIntervalMax: 10000,
  });
  await new Promise((resolve) => client.onConnect(resolve));
  return client;
}
