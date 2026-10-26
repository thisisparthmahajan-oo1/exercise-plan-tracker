import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

import * as schema from './schema';

export const sqliteDb = openDatabaseSync('fitness.db', { enableChangeListener: true });
export const db = drizzle(sqliteDb, { schema });
export type DB = typeof db;

// Foreign keys are enforced only *after* migrations have run. Drizzle's
// table-rebuild migrations drop and recreate tables; with enforcement on, that
// would cascade-delete child rows (e.g. every set_log of a session). Call once
// at startup, after useDbMigrations() reports success.
export function enableForeignKeys(): void {
  sqliteDb.execSync('PRAGMA foreign_keys = ON');
}
