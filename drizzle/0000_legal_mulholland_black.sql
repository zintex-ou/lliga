CREATE TABLE `appearance` (
	`match_id` integer NOT NULL,
	`player_id` integer NOT NULL,
	`role` text DEFAULT 'titular' NOT NULL,
	`entered` integer DEFAULT true NOT NULL,
	`conceded` integer,
	PRIMARY KEY(`match_id`, `player_id`),
	FOREIGN KEY (`match_id`) REFERENCES `match`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_id`) REFERENCES `player`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`entity` text NOT NULL,
	`entity_id` integer,
	`action` text NOT NULL,
	`at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `document` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`category` text DEFAULT 'documentacio' NOT NULL,
	`file` text,
	`body` text,
	`sort` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `event` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`match_id` integer NOT NULL,
	`player_id` integer NOT NULL,
	`type` text NOT NULL,
	`minute` integer,
	`assist_id` integer,
	`sort` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`match_id`) REFERENCES `match`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_id`) REFERENCES `player`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `event_match_idx` ON `event` (`match_id`);--> statement-breakpoint
CREATE INDEX `event_player_idx` ON `event` (`player_id`);--> statement-breakpoint
CREATE TABLE `grp` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`season_id` integer NOT NULL,
	`name` text NOT NULL,
	`top_slots` integer DEFAULT 1 NOT NULL,
	`releg_slots` integer DEFAULT 2 NOT NULL,
	`top_label` text DEFAULT 'campio' NOT NULL,
	FOREIGN KEY (`season_id`) REFERENCES `season`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `match` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`round_id` integer NOT NULL,
	`home_id` integer NOT NULL,
	`away_id` integer NOT NULL,
	`date` text,
	`time` text,
	`field` text,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`home_goals` integer,
	`away_goals` integer,
	`referee` text,
	`notes` text,
	`updated_by` integer,
	`updated_at` text,
	FOREIGN KEY (`round_id`) REFERENCES `round`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`home_id`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`away_id`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `match_round_idx` ON `match` (`round_id`);--> statement-breakpoint
CREATE TABLE `page` (
	`slug` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`body` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `player` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`team_id` integer NOT NULL,
	`surname` text NOT NULL,
	`name` text NOT NULL,
	`dob` text,
	`position` text DEFAULT 'MIG' NOT NULL,
	`dorsal` integer,
	`photo` text,
	`registered_at` text,
	`active` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `player_team_idx` ON `player` (`team_id`);--> statement-breakpoint
CREATE TABLE `post` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`kind` text DEFAULT 'noticia' NOT NULL,
	`published_at` text NOT NULL,
	`published` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `round` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`group_id` integer NOT NULL,
	`number` integer NOT NULL,
	`date` text NOT NULL,
	`alt_date` text,
	FOREIGN KEY (`group_id`) REFERENCES `grp`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sanction` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`player_id` integer NOT NULL,
	`event_id` integer,
	`match_id` integer,
	`round_number` integer,
	`matches` integer DEFAULT 1 NOT NULL,
	`served_override` integer,
	`reason` text DEFAULT 'falta_joc' NOT NULL,
	`notes` text,
	`created_at` text,
	FOREIGN KEY (`player_id`) REFERENCES `player`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `season` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`active` integer DEFAULT false NOT NULL,
	`yellows_for_ban` integer DEFAULT 5 NOT NULL,
	`assists_enabled` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `setting` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `staff` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`team_id` integer NOT NULL,
	`name` text NOT NULL,
	`role` text DEFAULT 'delegat' NOT NULL,
	`phone` text,
	`phone_visible` integer DEFAULT false NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`team_id`) REFERENCES `team`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `team` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`group_id` integer NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`short` text,
	`logo` text,
	`photo` text,
	`colors` text,
	`field` text,
	`town` text,
	`founded` text,
	`info` text,
	FOREIGN KEY (`group_id`) REFERENCES `grp`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `team_slug_unique` ON `team` (`slug`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'delegat' NOT NULL,
	`team_id` integer,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);