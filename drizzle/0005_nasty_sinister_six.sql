CREATE TABLE `referee_rating` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`match_id` integer NOT NULL,
	`referee_id` integer NOT NULL,
	`team_id` integer NOT NULL,
	`user_id` integer,
	`score` integer NOT NULL,
	`comment` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`match_id`) REFERENCES `match`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `rr_match_team` ON `referee_rating` (`match_id`,`team_id`);--> statement-breakpoint
CREATE INDEX `rr_ref` ON `referee_rating` (`referee_id`);