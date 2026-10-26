import { sqliteDb } from './client';

// Writes a consistent, standalone copy of the whole database next to the live
// file (same app-sandbox directory, so it rides along with device backups).
// Used before any step that rewrites existing rows. Returns the backup path.
export function backupDatabase(label: string): string {
  const livePath = sqliteDb.databasePath.replace(/^file:\/\//, '');
  const dir = livePath.slice(0, livePath.lastIndexOf('/'));
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const path = `${dir}/fitness.backup-${label}-${stamp}.db`;
  // VACUUM INTO snapshots the DB (including un-checkpointed WAL pages) into a
  // fresh file without touching the original.
  sqliteDb.runSync('VACUUM INTO ?', path);
  return path;
}
