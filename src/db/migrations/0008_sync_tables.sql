CREATE TABLE `_sync_outbox` (
	`table_name` text NOT NULL,
	`row_id` text NOT NULL,
	`changed_at` integer NOT NULL,
	PRIMARY KEY(`table_name`, `row_id`)
);
--> statement-breakpoint
CREATE TABLE `_sync_state` (
	`id` text PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	`cursor` integer DEFAULT 0 NOT NULL,
	`applying` integer DEFAULT 0 NOT NULL,
	`account_id` text,
	`last_synced_at` integer
);
