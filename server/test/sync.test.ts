import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';

import { MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';

import type { PullResponse, PushResponse, SyncChange } from '../../src/sync/protocol';
import { createApp } from '../src/createApp';
import { hashPassword } from '../src/auth';
import { connect } from '../src/mongo';

let mongo: MongoMemoryServer;
let client: MongoClient;
let server: ReturnType<ReturnType<typeof createApp>['listen']>;
let base: string;
let token: string;

before(async () => {
  mongo = await MongoMemoryServer.create();
  const conn = await connect(mongo.getUri(), 'test');
  client = conn.client;
  await conn.cols.users.insertOne({
    _id: 'u1',
    email: 'me@example.com',
    passwordHash: await hashPassword('pw'),
    createdAt: new Date(),
  });
  server = createApp(async () => conn.cols, 'secret').listen(0);
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  server.close();
  await client.close();
  await mongo.stop();
});

async function call<T>(method: string, path: string, body?: unknown, auth = true) {
  const res = await fetch(base + path, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(auth ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: (await res.json()) as T };
}

const row = (id: string, t: number, extra: Record<string, number | string> = {}): SyncChange => ({
  table: 'set_logs',
  id,
  data: { id, reps: 5, ...extra },
  deleted: false,
  clientUpdatedAt: t,
});

test('login', async () => {
  const bad = await call('POST', '/auth/login', { email: 'me@example.com', password: 'x' }, false);
  assert.equal(bad.status, 401);
  const ok = await call<{ token: string }>(
    'POST', '/auth/login', { email: 'ME@example.com', password: 'pw' }, false,
  );
  assert.equal(ok.status, 200);
  token = ok.body.token;
});

test('sync endpoints require auth', async () => {
  const res = await call('GET', '/sync/pull', undefined, false);
  assert.equal(res.status, 401);
});

test('push then pull round-trips rows in version order', async () => {
  const push = await call<PushResponse>('POST', '/sync/push', {
    changes: [row('a', 100), row('b', 100)],
  });
  assert.equal(push.status, 200);
  assert.deepEqual(push.body.rejected, []);

  const pull = await call<PullResponse>('GET', '/sync/pull?since=0');
  assert.deepEqual(pull.body.changes.map((c) => c.id), ['a', 'b']);
  assert.equal(pull.body.hasMore, false);
});

test('older write is rejected with the newer server state; newer wins', async () => {
  await call('POST', '/sync/push', { changes: [row('a', 200, { reps: 8 })] });
  const stale = await call<PushResponse>('POST', '/sync/push', {
    changes: [row('a', 150, { reps: 1 })],
  });
  assert.equal(stale.body.rejected.length, 1);
  assert.equal(stale.body.rejected[0].data?.reps, 8);
});

test('re-sending the same change is idempotent', async () => {
  const again = await call<PushResponse>('POST', '/sync/push', {
    changes: [row('a', 200, { reps: 8 })],
  });
  assert.deepEqual(again.body.rejected, []);
});

test('tombstones propagate and pulls page by cursor', async () => {
  const { body: start } = await call<PullResponse>('GET', '/sync/pull?since=0');
  const cursor = start.nextCursor;
  await call('POST', '/sync/push', {
    changes: [
      { table: 'set_logs', id: 'b', data: null, deleted: true, clientUpdatedAt: 300 },
      row('c', 300),
      row('d', 300),
    ],
  });
  const p1 = await call<PullResponse>('GET', `/sync/pull?since=${cursor}&limit=2`);
  assert.equal(p1.body.hasMore, true);
  assert.deepEqual(p1.body.changes.map((c) => [c.id, c.deleted]), [['b', true], ['c', false]]);
  const p2 = await call<PullResponse>('GET', `/sync/pull?since=${p1.body.nextCursor}&limit=2`);
  assert.equal(p2.body.hasMore, false);
  assert.deepEqual(p2.body.changes.map((c) => c.id), ['d']);
});

test('rejects unknown tables and mismatched ids', async () => {
  const badTable = await call('POST', '/sync/push', {
    changes: [{ ...row('x', 1), table: 'app_settings' }],
  });
  assert.equal(badTable.status, 400);
  const badId = await call('POST', '/sync/push', {
    changes: [{ ...row('x', 1), data: { id: 'y' } }],
  });
  assert.equal(badId.status, 400);
});

test('concurrent pushes serialize: every row lands and none are skipped', async () => {
  const { body: start } = await call<PullResponse>('GET', '/sync/pull?since=0');
  const ids = ['p1', 'p2', 'p3', 'p4', 'p5'];
  const results = await Promise.all(
    ids.map((id) => call<PushResponse>('POST', '/sync/push', { changes: [row(id, 500)] })),
  );
  assert.ok(results.every((r) => r.status === 200));
  const after = await call<PullResponse>('GET', `/sync/pull?since=${start.nextCursor}`);
  assert.deepEqual(after.body.changes.map((c) => c.id).sort(), ids);
  assert.equal(await client.db('test').collection('locks').countDocuments(), 0, 'lock released');
});
