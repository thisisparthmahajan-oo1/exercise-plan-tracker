import type { Request, Response } from 'express';
import { MongoServerError } from 'mongodb';
import { z } from 'zod';

import type {
  PullResponse,
  PushRequest,
  PushResponse,
  SyncChange,
} from '../../src/sync/protocol';
import { SYNCED_TABLE_ORDER } from '../../src/sync/tables';
import { withUserLock } from './lock';
import type { Collections, RecordDoc } from './mongo';

export const MAX_PUSH = 500;
const DEFAULT_PULL = 500;
const MAX_PULL = 2000;

const rowDataSchema = z.record(z.string(), z.union([z.string(), z.number(), z.null()]));

const changeSchema = z
  .object({
    table: z.enum(SYNCED_TABLE_ORDER),
    id: z.string().min(1).max(200),
    data: rowDataSchema.nullable(),
    deleted: z.boolean(),
    clientUpdatedAt: z.number().int().nonnegative(),
  })
  .refine((c) => (c.deleted ? c.data === null : c.data !== null && c.data.id === c.id), {
    message: 'Tombstones carry no data; live rows carry data whose id matches',
  });

const pushSchema = z.object({
  changes: z.array(changeSchema).max(MAX_PUSH),
}) satisfies z.ZodType<PushRequest, unknown>;

const pullQuerySchema = z.object({
  since: z.coerce.number().int().nonnegative().default(0),
  limit: z.coerce.number().int().min(1).max(MAX_PULL).default(DEFAULT_PULL),
});

function toChange(doc: RecordDoc): SyncChange {
  return {
    table: doc.table,
    id: doc.id,
    data: doc.data,
    deleted: doc.deleted,
    clientUpdatedAt: doc.clientUpdatedAt,
  };
}

// Reserves `count` consecutive versions for a user; returns the first.
async function reserveVersions(cols: Collections, userId: string, count: number) {
  const doc = await cols.counters.findOneAndUpdate(
    { _id: userId },
    { $inc: { version: count } },
    { upsert: true, returnDocument: 'after' },
  );
  return doc!.version - count + 1;
}

// Last-write-wins per row on the device's edit time. A change older than what
// the server holds is not applied; the newer server state is returned instead
// so the device can adopt it. Re-sending an already-applied change is harmless.
export async function push(cols: Collections, userId: string, changes: SyncChange[]) {
  return withUserLock(userId, async (): Promise<PushResponse> => {
    if (changes.length === 0) return { rejected: [] };
    let version = await reserveVersions(cols, userId, changes.length);
    const rejected: SyncChange[] = [];

    for (const c of changes) {
      const key = { userId, table: c.table, id: c.id };
      try {
        await cols.records.updateOne(
          { ...key, clientUpdatedAt: { $lte: c.clientUpdatedAt } },
          {
            $set: {
              data: c.deleted ? null : c.data,
              deleted: c.deleted,
              clientUpdatedAt: c.clientUpdatedAt,
              version: version++,
              serverUpdatedAt: new Date(),
            },
          },
          { upsert: true },
        );
      } catch (e) {
        // Duplicate key = the row exists with a newer clientUpdatedAt, so the
        // filter missed and the upsert collided with it.
        if (!(e instanceof MongoServerError && e.code === 11000)) throw e;
        const current = await cols.records.findOne(key);
        if (current) rejected.push(toChange(current));
      }
    }
    return { rejected };
  });
}

export async function pull(cols: Collections, userId: string, since: number, limit: number) {
  return withUserLock(userId, async (): Promise<PullResponse> => {
    const docs = await cols.records
      .find({ userId, version: { $gt: since } })
      .sort({ version: 1 })
      .limit(limit + 1)
      .toArray();
    const hasMore = docs.length > limit;
    const page = hasMore ? docs.slice(0, limit) : docs;
    return {
      changes: page.map((d) => ({ ...toChange(d), version: d.version })),
      nextCursor: page.length > 0 ? page[page.length - 1].version : since,
      hasMore,
    };
  });
}

export function pushHandler(cols: Collections) {
  return async (req: Request, res: Response) => {
    const parsed = pushSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid push', issues: parsed.error.issues.slice(0, 5) });
    }
    res.json(await push(cols, res.locals.userId as string, parsed.data.changes));
  };
}

export function pullHandler(cols: Collections) {
  return async (req: Request, res: Response) => {
    const parsed = pullQuerySchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid pull' });
    const { since, limit } = parsed.data;
    res.json(await pull(cols, res.locals.userId as string, since, limit));
  };
}
