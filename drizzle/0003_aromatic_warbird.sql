CREATE TABLE `push_subscription` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`team_key` text,
	`group_name` text,
	`lang` text DEFAULT 'ca' NOT NULL,
	`created_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `push_subscription_endpoint_unique` ON `push_subscription` (`endpoint`);