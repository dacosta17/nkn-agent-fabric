export async function mapConcurrent(items, worker, concurrency = items.length || 1) {
  if (!Array.isArray(items)) throw new TypeError('items must be an array');
  if (!Number.isInteger(concurrency) || concurrency < 1) throw new RangeError('concurrency must be a positive integer');
  const results = new Array(items.length);
  let next = 0;

  async function run() {
    while (true) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }

  const workerCount = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workerCount }, () => run()));
  return results;
}
