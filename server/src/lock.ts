// Per-user async mutex. Push and pull for one user run strictly one at a time,
// so a pull can never observe version N+1 before version N is written (which
// would let its cursor skip N forever). In-process only — correct while the
// server runs as a single instance, which is the deployment shape for now.
const tails = new Map<string, Promise<unknown>>();

export function withUserLock<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  const prev = tails.get(userId) ?? Promise.resolve();
  const run = prev.then(fn, fn);
  const tail = run.catch(() => undefined);
  tails.set(userId, tail);
  void tail.then(() => {
    if (tails.get(userId) === tail) tails.delete(userId);
  });
  return run;
}
