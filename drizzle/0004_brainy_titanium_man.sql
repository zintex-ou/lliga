CREATE TABLE `report` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`match_id` integer,
	`message` text NOT NULL,
	`contact` text,
	`created_at` text NOT NULL,
	`resolved` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `visit` (
	`day` text NOT NULL,
	`path` text NOT NULL,
	`views` integer DEFAULT 0 NOT NULL,
	`visitors` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`day`, `path`)
);
--> statement-breakpoint
ALTER TABLE `match` ADD `published` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `referee_id` integer;