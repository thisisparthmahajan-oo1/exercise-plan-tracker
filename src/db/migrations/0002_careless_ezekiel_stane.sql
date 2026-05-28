ALTER TABLE `exercises` ADD `tracking_type` text DEFAULT 'reps' NOT NULL;--> statement-breakpoint
ALTER TABLE `set_logs` ADD `hold_seconds` integer;