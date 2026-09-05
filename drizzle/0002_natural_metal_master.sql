CREATE TABLE `referee` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`phone` text,
	`active` integer DEFAULT true NOT NULL,
	`notes` text
);
--> statement-breakpoint
ALTER TABLE `match` ADD `referee_id` integer;