import nkn from 'nkn-sdk';

export async function createNknTransport({ identifier, maxNumSubClients = 4 } = {}) {
  const client = new nkn.MultiClient({
    identifier,
    maxNumSubClients,
    responseTimeout: 5000,
    reconnectIntervalMin: 1000,
    reconnectIntervalMax: 10000,
  });
  await new Promise((resolve, reject) => {
    let settled = false;
    const onConnect = () => { if (!settled) { settled = true; resolve(); } };
    const onError = (err) => { if (!settled) { settled = true; reject(err); } };
    client.onConnect = onConnect;
    client.onConnectFailed = onError;
  });
  return client;
}
