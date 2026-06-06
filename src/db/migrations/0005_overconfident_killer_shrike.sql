CREATE TABLE `app_settings` (
	`id` text PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	`rest_timer_disabled` integer DEFAULT false NOT NULL
);
