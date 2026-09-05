CREATE TABLE `team_photo` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`team_key` text NOT NULL,
	`season` text NOT NULL,
	`file` text NOT NULL,
	`caption` text,
	`sort` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `team_photo_key_idx` ON `team_photo` (`team_key`);