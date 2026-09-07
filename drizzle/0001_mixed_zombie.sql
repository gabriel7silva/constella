CREATE TABLE `block_proposal` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`slug` text NOT NULL,
	`kind` text DEFAULT 'note' NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`by_agent_handle` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`decided_at` integer,
	`decided_by` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `block_prop_ws_idx` ON `block_proposal` (`workspace_id`,`status`);--> statement-breakpoint
CREATE TABLE `deploy_run` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`status` text DEFAULT 'idle' NOT NULL,
	`run_id` text DEFAULT '' NOT NULL,
	`steps` text DEFAULT '[]' NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`build_log` text DEFAULT '' NOT NULL,
	`checklist` text DEFAULT '[]' NOT NULL,
	`last_export` text,
	`started_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `deploy_run_ws_idx` ON `deploy_run` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `file_lock` (
	`workspace_id` text NOT NULL,
	`path` text NOT NULL,
	`task_id` text DEFAULT '' NOT NULL,
	`agent_id` text DEFAULT '' NOT NULL,
	`agent_handle` text DEFAULT '' NOT NULL,
	`acquired_at` integer DEFAULT (unixepoch()) NOT NULL,
	`heartbeat_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`workspace_id`, `path`)
);
--> statement-breakpoint
CREATE TABLE `kb_entry` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`type` text DEFAULT 'note' NOT NULL,
	`title` text NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`goal_id` text,
	`spec_id` text,
	`issue_id` text,
	`task_id` text,
	`module` text DEFAULT '' NOT NULL,
	`paths` text,
	`agent_handle` text DEFAULT '' NOT NULL,
	`source_kind` text DEFAULT '' NOT NULL,
	`source_ref` text DEFAULT '' NOT NULL,
	`supersedes_id` text,
	`hash` text DEFAULT '' NOT NULL,
	`confidence` integer DEFAULT 70 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `kb_ws_type_idx` ON `kb_entry` (`workspace_id`,`type`);--> statement-breakpoint
CREATE INDEX `kb_ws_goal_idx` ON `kb_entry` (`workspace_id`,`goal_id`);--> statement-breakpoint
CREATE TABLE `kb_query_log` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`agent_handle` text DEFAULT '' NOT NULL,
	`query` text DEFAULT '' NOT NULL,
	`hits` integer DEFAULT 0 NOT NULL,
	`mode` text DEFAULT '' NOT NULL,
	`refs` text,
	`answered_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `kb_query_ws_idx` ON `kb_query_log` (`workspace_id`,`answered_at`);--> statement-breakpoint
CREATE TABLE `synced_block` (
	`workspace_id` text NOT NULL,
	`slug` text NOT NULL,
	`kind` text DEFAULT 'note' NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_by` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`workspace_id`, `slug`),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `agent_skill` ADD `auto` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `message` ADD `task_id` text;--> statement-breakpoint
ALTER TABLE `message` ADD `kind` text;--> statement-breakpoint
ALTER TABLE `message` ADD `blocks` text;--> statement-breakpoint
ALTER TABLE `notification_pref` ADD `reduced_motion` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `rag_chunk` ADD `kb_entry_id` text;--> statement-breakpoint
ALTER TABLE `rag_chunk` ADD `obsolete` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `skill` ADD `proposed_role` text;