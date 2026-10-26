import { randomUUID } from 'node:crypto';

import { MongoServerError, type Collection } from 'mongodb';

// Per-user mutex held as a lease document in Mongo, so it works across the
// many concurrent instances a serverless host may run. Push and pull for one
// user run strictly one at a time, so a pull can never observe version N+1
// before version N is written (which would let its cursor skip N forever).
// The lease expires on its own if an instance dies mid-request.

export type LockDoc = { _id: string; owner: string; expiresAt: Date };

const LEASE_MS = 30_000;
const WAIT_MS = 20_000;

export async function withUserLock<T>(
  locks: Collection<LockDoc>,
  userId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const owner = randomUUID();
  const giveUpAt = Date.now() + WAIT_MS;
  for (;;) {
    const now = Date.now();
    try {
      // Matches only a missing or expired lease; a live one makes the upsert
      // collide on _id.
      await locks.updateOne(
        { _id: userId, expiresAt: { $lt: new Date(now) } },
        { $set: { owner, expiresAt: new Date(now + LEASE_MS) } },
        { upsert: true },
      );
      break;
    } catch (e) {
      if (!(e instanceof MongoServerError && e.code === 11000)) throw e;
      if (Date.now() > giveUpAt) throw new Error('Sync is busy — try again shortly');
      await new Promise((r) => setTimeout(r, 50 + Math.random() * 100));
    }
  }
  try {
    return await fn();
  } finally {
    await locks.deleteOne({ _id: userId, owner });
  }
}
