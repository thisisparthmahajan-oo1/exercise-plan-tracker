import { MongoClient, type Collection, type Db } from 'mongodb';

import type { RowData } from '../../src/sync/protocol';
import { env } from './env';
import type { LockDoc } from './lock';

export type UserDoc = {
  _id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
};

// Latest known state of one synced row for one user. `version` is a per-user
// monotonically increasing number assigned on every accepted write; pulls page
// through it.
export type RecordDoc = {
  userId: string;
  table: string;
  id: string;
  data: RowData | null;
  deleted: boolean;
  clientUpdatedAt: number;
  version: number;
  serverUpdatedAt: Date;
};

export type CounterDoc = { _id: string; version: number };

export type Collections = {
  users: Collection<UserDoc>;
  records: Collection<RecordDoc>;
  counters: Collection<CounterDoc>;
  locks: Collection<LockDoc>;
};

export async function connect(uri: string, dbName: string) {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(dbName);
  const cols = collections(db);
  await ensureIndexes(cols);
  return { client, cols };
}

export function collections(db: Db): Collections {
  return {
    users: db.collection<UserDoc>('users'),
    records: db.collection<RecordDoc>('records'),
    counters: db.collection<CounterDoc>('counters'),
    locks: db.collection<LockDoc>('locks'),
  };
}

// One connection per server instance, opened on first use and reused across
// requests (serverless instances stay warm between invocations).
let shared: Promise<Collections> | null = null;
export function getCollections(): Promise<Collections> {
  shared ??= connect(env.mongoUri, env.mongoDb)
    .then((c) => c.cols)
    .catch((e) => {
      shared = null;
      throw e;
    });
  return shared;
}

async function ensureIndexes(cols: Collections) {
  await cols.users.createIndex({ email: 1 }, { unique: true });
  await cols.records.createIndex({ userId: 1, table: 1, id: 1 }, { unique: true });
  await cols.records.createIndex({ userId: 1, version: 1 });
}
