CREATE TABLE `design_comment` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`page_key` text NOT NULL,
	`xp` real NOT NULL,
	`yp` real NOT NULL,
	`body` text NOT NULL,
	`reply` text DEFAULT '' NOT NULL,
	`selection` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `design_session`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `design_comment_sess_idx` ON `design_comment` (`session_id`);--> statement-breakpoint
CREATE TABLE `design_page` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`key` text NOT NULL,
	`name` text NOT NULL,
	`tree` text,
	FOREIGN KEY (`session_id`) REFERENCES `design_session`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `design_page_sess_idx` ON `design_page` (`session_id`);--> statement-breakpoint
CREATE TABLE `design_session` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`title` text DEFAULT 'Design session' NOT NULL,
	`status` text DEFAULT 'building' NOT NULL,
	`tokens` text DEFAULT '{}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `design_session_ws_idx` ON `design_session` (`workspace_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `design_version` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`label` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`patch` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `design_session`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `design_version_sess_idx` ON `design_version` (`session_id`,`created_at`);--> statement-breakpoint
ALTER TABLE `cost_entry` ADD `channel` text;