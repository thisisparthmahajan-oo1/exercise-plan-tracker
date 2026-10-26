// Stand-in for src/db/client.ts: an expo-sqlite-shaped facade over sql.js
// (SQLite compiled to WASM). Holds several named "devices" and routes every
// call to the active one, so one test process can play two phones.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import initSqlJs, { type Database, type SqlValue } from 'sql.js';

const MIGRATIONS_DIR = join(__dirname, '../../../src/db/migrations');

type Params = SqlValue[];
const devices = new Map<string, Database>();
let active: Database | null = null;

let SQL: Awaited<ReturnType<typeof initSqlJs>> | null = null;

export async function createDevice(name: string): Promise<void> {
  SQL ??= await initSqlJs();
  const db = new SQL.Database();
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
  for (const f of files) {
    for (const stmt of readFileSync(join(MIGRATIONS_DIR, f), 'utf8').split('--> statement-breakpoint')) {
      if (stmt.trim()) db.exec(stmt);
    }
  }
  db.exec('PRAGMA foreign_keys = ON');
  devices.set(name, db);
}

export function useDevice(name: string): void {
  active = devices.get(name)!;
}

function db(): Database {
  if (!active) throw new Error('no active device');
  return active;
}

function flat(args: unknown[]): Params {
  return (args.length === 1 && Array.isArray(args[0]) ? args[0] : args) as Params;
}

export const sqliteDb = {
  getAllSync<T>(sql: string, ...args: unknown[]): T[] {
    const stmt = db().prepare(sql);
    stmt.bind(flat(args));
    const rows: T[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject() as T);
    stmt.free();
    return rows;
  },
  getFirstSync<T>(sql: string, ...args: unknown[]): T | null {
    return sqliteDb.getAllSync<T>(sql, ...args)[0] ?? null;
  },
  runSync(sql: string, ...args: unknown[]): void {
    db().run(sql, flat(args));
  },
  execSync(sql: string): void {
    db().exec(sql);
  },
  withTransactionSync(task: () => void): void {
    db().exec('BEGIN');
    try {
      task();
      db().exec('COMMIT');
    } catch (e) {
      db().exec('ROLLBACK');
      throw e;
    }
  },
};
