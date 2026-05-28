CREATE TABLE `routine_set_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`routine_exercise_id` text NOT NULL,
	`set_number` integer NOT NULL,
	`planned_reps` integer NOT NULL,
	`planned_weight` real NOT NULL,
	FOREIGN KEY (`routine_exercise_id`) REFERENCES `routine_exercises`(`id`) ON UPDATE no action ON DELETE cascade
);
