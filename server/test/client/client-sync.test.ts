// End-to-end: the app's real sync engine (src/sync/engine.ts + local.ts) on
// two simulated phones, against the real server and an in-memory Mongo.
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, test } from 'node:test';

import { MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';

import express from 'express';

import { configureApp } from '../../src/configureApp';
import { connect } from '../../src/mongo';
import { createDevice, sqliteDb, useDevice } from './fake-db-client';
import { useDeviceStore } from './fake-secure-store';

type Engine = typeof import('../../../src/sync/engine');
let engine: Engine;
const APP_TOKEN = 'test-app-token-0123456789abcdef';
let mongo: MongoMemoryServer;
let client: MongoClient;
let server: ReturnType<ReturnType<typeof express>['listen']>;

const run = (sql: string, ...p: (string | number | null)[]) => sqliteDb.runSync(sql, ...p);
const all = <T = Record<string, unknown>>(sql: string, ...p: (string | number)[]) =>
  sqliteDb.getAllSync<T>(sql, ...p);
const count = (table: string) => all<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`)[0].n;

async function onDevice(name: string) {
  useDevice(name);
  useDeviceStore(name);
  await engine.initSync();
}

// A deterministic dump of user data on the active device.
function dump() {
  const tables = [
    "exercises WHERE is_seeded = 0",
    'routines',
    'routine_exercises',
    'routine_set_plans',
    'workout_sessions',
    'set_logs',
    'body_metric_logs',
  ];
  return Object.fromEntries(
    tables.map((t) => [t, all(`SELECT * FROM ${t} ORDER BY id`)]),
  );
}

function seedBuiltins() {
  run("INSERT INTO exercises (id, is_seeded, name) VALUES ('seed:bench-press', 1, 'Bench Press')");
  run("INSERT INTO exercises (id, is_seeded, name) VALUES ('seed:plank', 1, 'Plank')");
}

before(async () => {
  mongo = await MongoMemoryServer.create();
  const conn = await connect(mongo.getUri(), 'e2e');
  client = conn.client;
  server = configureApp(express(), async () => conn.cols, APP_TOKEN).listen(0);
  process.env.EXPO_PUBLIC_SYNC_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  engine = await import('../../../src/sync/engine');

  // Phone A: existing history from before sync existed (written with the
  // triggers muted, as if it predates them), including an orphan set log
  // left behind by an old session delete when FKs weren't enforced.
  await createDevice('A');
  useDevice('A');
  seedBuiltins();
  run("UPDATE _sync_state SET applying = 1");
  run("INSERT INTO exercises (id, is_seeded, name, tracking_type) VALUES ('ex-custom', 0, 'Sled Push', 'reps')");
  run("INSERT INTO routines (id, name, position) VALUES ('r1', 'Push Day', 0)");
  run("INSERT INTO routine_exercises (id, routine_id, exercise_id, position, planned_sets, planned_reps, planned_weight) VALUES ('re1', 'r1', 'seed:bench-press', 0, 3, 8, 60)");
  run("INSERT INTO routine_set_plans (id, routine_exercise_id, set_number, planned_reps, planned_weight) VALUES ('sp1', 're1', 1, 8, 60)");
  run("INSERT INTO workout_sessions (id, routine_id, started_at, ended_at) VALUES ('s1', 'r1', 1000, 2000)");
  run("INSERT INTO set_logs (id, session_id, exercise_id, set_number, reps, weight, completed_at) VALUES ('l1', 's1', 'seed:bench-press', 1, 8, 60, 1500)");
  run("INSERT INTO set_logs (id, session_id, exercise_id, set_number, reps, weight, completed_at) VALUES ('l2', 's1', 'ex-custom', 1, 10, 40, 1600)");
  run("INSERT INTO body_metric_logs (id, metric, value, date) VALUES ('weight:2026-10-01', 'weight', 72.5, '2026-10-01')");
  run('PRAGMA foreign_keys = OFF');
  run("INSERT INTO set_logs (id, session_id, exercise_id, set_number, reps, weight) VALUES ('orphan', 'deleted-session', 'seed:bench-press', 1, 5, 50)");
  run('PRAGMA foreign_keys = ON');
  run("UPDATE _sync_state SET applying = 0");

  await createDevice('B');
  useDevice('B');
  seedBuiltins();
});

after(async () => {
  server.closeAllConnections();
  server.close();
  await client.close();
  await mongo.stop();
});

test('first sign-in uploads existing history; nothing local is lost', async () => {
  await onDevice('A');
  const before = dump();
  assert.equal(count('_sync_outbox'), 0);

  await engine.signIn(APP_TOKEN);
  await engine.syncNow();

  assert.equal(engine.getSyncStatus().error, null);
  assert.equal(count('_sync_outbox'), 0);
  assert.deepEqual(dump(), before, 'device A data unchanged by syncing');
  assert.equal(all("SELECT id FROM set_logs WHERE id = 'orphan'").length, 1, 'orphan kept locally');
});

test('a fresh device signs in and receives the full history', async () => {
  await onDevice('B');
  await engine.signIn(APP_TOKEN);
  await engine.syncNow();
  assert.equal(engine.getSyncStatus().error, null);
  const onB = dump();

  await onDevice('A');
  const onA = dump();
  // Everything except the orphan (never uploaded) matches row-for-row.
  onA.set_logs = (onA.set_logs as { id: string }[]).filter((r) => r.id !== 'orphan');
  assert.deepEqual(onB, onA);
});

test('edits and cascade deletes propagate', async () => {
  await onDevice('A');
  run("UPDATE routines SET name = 'Push Day v2' WHERE id = 'r1'");
  run("INSERT INTO workout_sessions (id, routine_id, started_at) VALUES ('s2', 'r1', 3000)");
  run("INSERT INTO set_logs (id, session_id, exercise_id, set_number, reps, weight) VALUES ('l3', 's2', 'seed:plank', 1, 0, 0)");
  run("UPDATE workout_sessions SET ended_at = 4000 WHERE id = 's2'");
  run("DELETE FROM workout_sessions WHERE id = 's1'"); // cascades l1, l2
  await engine.syncNow();

  await onDevice('B');
  await engine.syncNow();
  assert.deepEqual(all("SELECT name FROM routines WHERE id = 'r1'"), [{ name: 'Push Day v2' }]);
  assert.deepEqual(all('SELECT id FROM workout_sessions ORDER BY id'), [{ id: 's2' }]);
  assert.deepEqual(all('SELECT id FROM set_logs ORDER BY id'), [{ id: 'l3' }]);
  assert.equal(count('_sync_outbox'), 0, 'pulled rows are not echoed back');
});

test('concurrent offline edits converge on the later one', async () => {
  await onDevice('A');
  run("UPDATE routines SET name = 'From A' WHERE id = 'r1'");
  await onDevice('B');
  await new Promise((r) => setTimeout(r, 5));
  run("UPDATE routines SET name = 'From B' WHERE id = 'r1'");

  await onDevice('A');
  await engine.syncNow();
  await onDevice('B');
  await engine.syncNow();
  await onDevice('A');
  await engine.syncNow();

  assert.deepEqual(all("SELECT name FROM routines WHERE id = 'r1'"), [{ name: 'From B' }]);
  await onDevice('B');
  assert.deepEqual(all("SELECT name FROM routines WHERE id = 'r1'"), [{ name: 'From B' }]);
});

test('same body metric logged on two devices for the same day stays one row', async () => {
  await onDevice('A');
  run("INSERT INTO body_metric_logs (id, metric, value, date) VALUES ('weight:2026-10-20', 'weight', 71, '2026-10-20')");
  await onDevice('B');
  await new Promise((r) => setTimeout(r, 5));
  run("INSERT INTO body_metric_logs (id, metric, value, date) VALUES ('weight:2026-10-20', 'weight', 71.4, '2026-10-20')");
  await engine.syncNow();
  await onDevice('A');
  await engine.syncNow();
  assert.deepEqual(all("SELECT value FROM body_metric_logs WHERE date = '2026-10-20'"), [{ value: 71.4 }]);
});

test('works offline: edits queue and drain once the server is reachable', async () => {
  await onDevice('A');
  const realUrl = process.env.EXPO_PUBLIC_SYNC_URL;
  server.closeAllConnections();
  server.close();
  run("INSERT INTO body_metric_logs (id, metric, value, date) VALUES ('waist:2026-10-21', 'waist', 32, '2026-10-21')");
  await engine.syncNow();
  assert.notEqual(engine.getSyncStatus().error, null);
  assert.equal(count('_sync_outbox'), 1, 'change waits in the outbox');
  assert.equal(all("SELECT id FROM body_metric_logs WHERE id = 'waist:2026-10-21'").length, 1);

  // Bring the server back on the same port.
  const conn = await connect(mongo.getUri(), 'e2e');
  await client.close();
  client = conn.client;
  server = configureApp(express(), async () => conn.cols, APP_TOKEN).listen(Number(new URL(realUrl!).port));
  await new Promise((r) => server.once('listening', r));
  await engine.syncNow();
  assert.equal(engine.getSyncStatus().error, null);
  assert.equal(count('_sync_outbox'), 0);
});
