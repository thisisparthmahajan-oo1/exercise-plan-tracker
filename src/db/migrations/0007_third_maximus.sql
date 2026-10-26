CREATE TABLE `body_metric_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`metric` text NOT NULL,
	`value` real NOT NULL,
	`date` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch() * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `body_metric_date_unq` ON `body_metric_logs` (`metric`,`date`);