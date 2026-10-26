-- Change tracking for offline-first sync (see src/sync/).
-- Every insert/update/delete on a synced table upserts (table, row id) into
-- _sync_outbox. Suppressed while _sync_state.applying = 1 (pulled server
-- changes). Built-in exercises (is_seeded = 1) are not synced: every device
-- seeds them with the same fixed ids. Keep this table list in sync with
-- SYNCED_TABLES in src/sync/tables.ts.
INSERT INTO `_sync_state` (`id`) VALUES ('singleton') ON CONFLICT DO NOTHING;
--> statement-breakpoint
CREATE TRIGGER `sync_exercises_ins` AFTER INSERT ON `exercises`
WHEN NEW.is_seeded = 0 AND (SELECT applying FROM _sync_state WHERE id = 'singleton') = 0
BEGIN
  INSERT INTO _sync_outbox (table_name, row_id, changed_at) VALUES ('exercises', NEW.id, CAST(unixepoch('subsec') * 1000 AS INTEGER))
    ON CONFLICT (table_name, row_id) DO UPDATE SET changed_at = excluded.changed_at;
END;
--> statement-breakpoint
CREATE TRIGGER `sync_exercises_upd` AFTER UPDATE ON `exercises`
WHEN NEW.is_seeded = 0 AND (SELECT applying FROM _sync_state WHERE id = 'singleton') = 0
BEGIN
  INSERT INTO _sync_outbox (table_name, row_id, changed_at) VALUES ('exercises', NEW.id, CAST(unixepoch('subsec') * 1000 AS INTEGER))
    ON CONFLICT (table_name, row_id) DO UPDATE SET changed_at = excluded.changed_at;
  INSERT INTO _sync_outbox (table_name, row_id, changed_at)
    SELECT 'exercises', OLD.id, CAST(unixepoch('subsec') * 1000 AS INTEGER) WHERE OLD.id <> NEW.id
    ON CONFLICT (table_name, row_id) DO UPDATE SET changed_at = excluded.changed_at;
END;
--> statement-breakpoint
CREATE TRIGGER `sync_exercises_del` AFTER DELETE ON `exercises`
WHEN OLD.is_seeded = 0 AND (SELECT applying FROM _sync_state WHERE id = 'singleton') = 0
BEGIN
  INSERT INTO _sync_outbox (table_name, row_id, changed_at) VALUES ('exercises', OLD.id, CAST(unixepoch('subsec') * 1000 AS INTEGER))
    ON CONFLICT (table_name, row_id) DO UPDATE SET changed_at = excluded.changed_at;
END;
--> statement-breakpoint
CREATE TRIGGER `sync_routines_ins` AFTER INSERT ON `routines`
WHEN (SELECT applying FROM _sync_state WHERE id = 'singleton') = 0
BEGIN
  INSERT INTO _sync_outbox (table_name, row_id, changed_at) VALUES ('routines', NEW.id, CAST(unixepoch('subsec') * 1000 AS INTEGER))
    ON CONFLICT (table_name, row_id) DO UPDATE SET changed_at = excluded.changed_at;
END;
--> statement-breakpoint
CREATE TRIGGER `sync_routines_upd` AFTER UPDATE ON `routines`
WHEN (SELECT applying FROM _sync_state WHERE id = 'singleton') = 0
BEGIN
  INSERT INTO _sync_outbox (table_name, row_id, changed_at) VALUES ('routines', NEW.id, CAST(unixepoch('subsec') * 1000 AS INTEGER))
    ON CONFLICT (table_name, row_id) DO UPDATE SET changed_at = excluded.changed_at;
  INSERT INTO _sync_outbox (table_name, row_id, changed_at)
    SELECT 'routines', OLD.id, CAST(unixepoch('subsec') * 1000 AS INTEGER) WHERE OLD.id <> NEW.id
    ON CONFLICT (table_name, row_id) DO UPDATE SET changed_at = excluded.changed_at;
END;
--> statement-breakpoint
CREATE TRIGGER `sync_routines_del` AFTER DELETE ON `routines`
WHEN (SELECT applying FROM _sync_state WHERE id = 'singleton') = 0
BEGIN
  INSERT INTO _sync_outbox (table_name, row_id, changed_at) VALUES ('routines', OLD.id, CAST(unixepoch('subsec') * 1000 AS INTEGER))
    ON CONFLICT (table_name, row_id) DO UPDATE SET changed_at = excluded.changed_at;
END;
--> statement-breakpoint
CREATE TRIGGER `sync_routine_exercises_ins` AFTER INSERT ON `routine_exercises`
WHEN (SELECT applying FROM _sync_state WHERE id = 'singleton') = 0
BEGIN
  INSERT INTO _sync_outbox (table_name, row_id, changed_at) VALUES ('routine_exercises', NEW.id, CAST(unixepoch('subsec') * 1000 AS INTEGER))
    ON CONFLICT (table_name, row_id) DO UPDATE SET changed_at = excluded.changed_at;
END;
--> statement-breakpoint
CREATE TRIGGER `sync_routine_exercises_upd` AFTER UPDATE ON `routine_exercises`
WHEN (SELECT applying FROM _sync_state WHERE id = 'singleton') = 0
BEGIN
  INSERT INTO _sync_outbox (table_name, row_id, changed_at) VALUES ('routine_exercises', NEW.id, CAST(unixepoch('subsec') * 1000 AS INTEGER))
    ON CONFLICT (table_name, row_id) DO UPDATE SET changed_at = excluded.changed_at;
  INSERT INTO _sync_outbox (table_name, row_id, changed_at)
    SELECT 'routine_exercises', OLD.id, CAST(unixepoch('subsec') * 1000 AS INTEGER) WHERE OLD.id <> NEW.id
    ON CONFLICT (table_name, row_id) DO UPDATE SET changed_at = excluded.changed_at;
END;
--> statement-breakpoint
CREATE TRIGGER `sync_routine_exercises_del` AFTER DELETE ON `routine_exercises`
WHEN (SELECT applying FROM _sync_state WHERE id = 'singleton') = 0
BEGIN
  INSERT INTO _sync_outbox (table_name, row_id, changed_at) VALUES ('routine_exercises', OLD.id, CAST(unixepoch('subsec') * 1000 AS INTEGER))
    ON CONFLICT (table_name, row_id) DO UPDATE SET changed_at = excluded.changed_at;
END;
--> statement-breakpoint
CREATE TRIGGER `sync_routine_set_plans_ins` AFTER INSERT ON `routine_set_plans`
WHEN (SELECT applying FROM _sync_state WHERE id = 'singleton') = 0
BEGIN
  INSERT INTO _sync_outbox (table_name, row_id, changed_at) VALUES ('routine_set_plans', NEW.id, CAST(unixepoch('subsec') * 1000 AS INTEGER))
    ON CONFLICT (table_name, row_id) DO UPDATE SET changed_at = excluded.changed_at;
END;
--> statement-breakpoint
CREATE TRIGGER `sync_routine_set_plans_upd` AFTER UPDATE ON `routine_set_plans`
WHEN (SELECT applying FROM _sync_state WHERE id = 'singleton') = 0
BEGIN
  INSERT INTO _sync_outbox (table_name, row_id, changed_at) VALUES ('routine_set_plans', NEW.id, CAST(unixepoch('subsec') * 1000 AS INTEGER))
    ON CONFLICT (table_name, row_id) DO UPDATE SET changed_at = excluded.changed_at;
  INSERT INTO _sync_outbox (table_name, row_id, changed_at)
    SELECT 'routine_set_plans', OLD.id, CAST(unixepoch('subsec') * 1000 AS INTEGER) WHERE OLD.id <> NEW.id
    ON CONFLICT (table_name, row_id) DO UPDATE SET changed_at = excluded.changed_at;
END;
--> statement-breakpoint
CREATE TRIGGER `sync_routine_set_plans_del` AFTER DELETE ON `routine_set_plans`
WHEN (SELECT applying FROM _sync_state WHERE id = 'singleton') = 0
BEGIN
  INSERT INTO _sync_outbox (table_name, row_id, changed_at) VALUES ('routine_set_plans', OLD.id, CAST(unixepoch('subsec') * 1000 AS INTEGER))
    ON CONFLICT (table_name, row_id) DO UPDATE SET changed_at = excluded.changed_at;
END;
--> statement-breakpoint
CREATE TRIGGER `sync_workout_sessions_ins` AFTER INSERT ON `workout_sessions`
WHEN (SELECT applying FROM _sync_state WHERE id = 'singleton') = 0
BEGIN
  INSERT INTO _sync_outbox (table_name, row_id, changed_at) VALUES ('workout_sessions', NEW.id, CAST(unixepoch('subsec') * 1000 AS INTEGER))
    ON CONFLICT (table_name, row_id) DO UPDATE SET changed_at = excluded.changed_at;
END;
--> statement-breakpoint
CREATE TRIGGER `sync_workout_sessions_upd` AFTER UPDATE ON `workout_sessions`
WHEN (SELECT applying FROM _sync_state WHERE id = 'singleton') = 0
BEGIN
  INSERT INTO _sync_outbox (table_name, row_id, changed_at) VALUES ('workout_sessions', NEW.id, CAST(unixepoch('subsec') * 1000 AS INTEGER))
    ON CONFLICT (table_name, row_id) DO UPDATE SET changed_at = excluded.changed_at;
  INSERT INTO _sync_outbox (table_name, row_id, changed_at)
    SELECT 'workout_sessions', OLD.id, CAST(unixepoch('subsec') * 1000 AS INTEGER) WHERE OLD.id <> NEW.id
    ON CONFLICT (table_name, row_id) DO UPDATE SET changed_at = excluded.changed_at;
END;
--> statement-breakpoint
CREATE TRIGGER `sync_workout_sessions_del` AFTER DELETE ON `workout_sessions`
WHEN (SELECT applying FROM _sync_state WHERE id = 'singleton') = 0
BEGIN
  INSERT INTO _sync_outbox (table_name, row_id, changed_at) VALUES ('workout_sessions', OLD.id, CAST(unixepoch('subsec') * 1000 AS INTEGER))
    ON CONFLICT (table_name, row_id) DO UPDATE SET changed_at = excluded.changed_at;
END;
--> statement-breakpoint
CREATE TRIGGER `sync_set_logs_ins` AFTER INSERT ON `set_logs`
WHEN (SELECT applying FROM _sync_state WHERE id = 'singleton') = 0
BEGIN
  INSERT INTO _sync_outbox (table_name, row_id, changed_at) VALUES ('set_logs', NEW.id, CAST(unixepoch('subsec') * 1000 AS INTEGER))
    ON CONFLICT (table_name, row_id) DO UPDATE SET changed_at = excluded.changed_at;
END;
--> statement-breakpoint
CREATE TRIGGER `sync_set_logs_upd` AFTER UPDATE ON `set_logs`
WHEN (SELECT applying FROM _sync_state WHERE id = 'singleton') = 0
BEGIN
  INSERT INTO _sync_outbox (table_name, row_id, changed_at) VALUES ('set_logs', NEW.id, CAST(unixepoch('subsec') * 1000 AS INTEGER))
    ON CONFLICT (table_name, row_id) DO UPDATE SET changed_at = excluded.changed_at;
  INSERT INTO _sync_outbox (table_name, row_id, changed_at)
    SELECT 'set_logs', OLD.id, CAST(unixepoch('subsec') * 1000 AS INTEGER) WHERE OLD.id <> NEW.id
    ON CONFLICT (table_name, row_id) DO UPDATE SET changed_at = excluded.changed_at;
END;
--> statement-breakpoint
CREATE TRIGGER `sync_set_logs_del` AFTER DELETE ON `set_logs`
WHEN (SELECT applying FROM _sync_state WHERE id = 'singleton') = 0
BEGIN
  INSERT INTO _sync_outbox (table_name, row_id, changed_at) VALUES ('set_logs', OLD.id, CAST(unixepoch('subsec') * 1000 AS INTEGER))
    ON CONFLICT (table_name, row_id) DO UPDATE SET changed_at = excluded.changed_at;
END;
--> statement-breakpoint
CREATE TRIGGER `sync_body_metric_logs_ins` AFTER INSERT ON `body_metric_logs`
WHEN (SELECT applying FROM _sync_state WHERE id = 'singleton') = 0
BEGIN
  INSERT INTO _sync_outbox (table_name, row_id, changed_at) VALUES ('body_metric_logs', NEW.id, CAST(unixepoch('subsec') * 1000 AS INTEGER))
    ON CONFLICT (table_name, row_id) DO UPDATE SET changed_at = excluded.changed_at;
END;
--> statement-breakpoint
CREATE TRIGGER `sync_body_metric_logs_upd` AFTER UPDATE ON `body_metric_logs`
WHEN (SELECT applying FROM _sync_state WHERE id = 'singleton') = 0
BEGIN
  INSERT INTO _sync_outbox (table_name, row_id, changed_at) VALUES ('body_metric_logs', NEW.id, CAST(unixepoch('subsec') * 1000 AS INTEGER))
    ON CONFLICT (table_name, row_id) DO UPDATE SET changed_at = excluded.changed_at;
  INSERT INTO _sync_outbox (table_name, row_id, changed_at)
    SELECT 'body_metric_logs', OLD.id, CAST(unixepoch('subsec') * 1000 AS INTEGER) WHERE OLD.id <> NEW.id
    ON CONFLICT (table_name, row_id) DO UPDATE SET changed_at = excluded.changed_at;
END;
--> statement-breakpoint
CREATE TRIGGER `sync_body_metric_logs_del` AFTER DELETE ON `body_metric_logs`
WHEN (SELECT applying FROM _sync_state WHERE id = 'singleton') = 0
BEGIN
  INSERT INTO _sync_outbox (table_name, row_id, changed_at) VALUES ('body_metric_logs', OLD.id, CAST(unixepoch('subsec') * 1000 AS INTEGER))
    ON CONFLICT (table_name, row_id) DO UPDATE SET changed_at = excluded.changed_at;
END;
