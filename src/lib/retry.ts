export async function retry<T>(
  fn: () => Promise<T>,
  opts: { attempts?: number; delayMs?: number; backoff?: number } = {}
): Promise<T> {
  const { attempts = 3, delayMs = 1000, backoff = 2 } = opts;
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, delayMs * Math.pow(backoff, i)));
      }
    }
  }
  throw last;
}
