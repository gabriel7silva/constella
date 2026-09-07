CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`password` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `activity` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`agent_id` text,
	`action` text NOT NULL,
	`target` text DEFAULT '' NOT NULL,
	`at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`agent_id`) REFERENCES `agent`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `activity_ws_idx` ON `activity` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `agent` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`handle` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`color` text DEFAULT '#e0a44e' NOT NULL,
	`image` text,
	`adapter` text DEFAULT 'cli_claude_code' NOT NULL,
	`model` text DEFAULT 'sonnet' NOT NULL,
	`temperature` real DEFAULT 0.4 NOT NULL,
	`daily_cap_usd` real DEFAULT 25 NOT NULL,
	`tier_floor` text DEFAULT 'heavy' NOT NULL,
	`reports_to` text,
	`status` text DEFAULT 'idle' NOT NULL,
	`health` text DEFAULT 'alive' NOT NULL,
	`last_pulse` integer,
	`persona` text,
	`rag` text,
	`org_x` real,
	`org_y` real,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `agent_ws_idx` ON `agent` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `agent_skill` (
	`agent_id` text NOT NULL,
	`skill_id` text NOT NULL,
	PRIMARY KEY(`agent_id`, `skill_id`),
	FOREIGN KEY (`agent_id`) REFERENCES `agent`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`skill_id`) REFERENCES `skill`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `backlog_item` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`title` text NOT NULL,
	`moscow` text DEFAULT 'Should' NOT NULL,
	`points` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `backlog_ws_idx` ON `backlog_item` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `budget` (
	`workspace_id` text PRIMARY KEY NOT NULL,
	`monthly_cap_usd` real DEFAULT 400 NOT NULL,
	`monthly_spent_usd` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `channel_read` (
	`workspace_id` text NOT NULL,
	`channel` text NOT NULL,
	`last_read_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`workspace_id`, `channel`),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `chat_session` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`channel` text NOT NULL,
	`title` text DEFAULT 'Session' NOT NULL,
	`active` integer DEFAULT false NOT NULL,
	`created_at` integer,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `chat_session_ws_chan_idx` ON `chat_session` (`workspace_id`,`channel`);--> statement-breakpoint
CREATE TABLE `cost_entry` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`agent_id` text,
	`provider` text,
	`model` text,
	`usd` real DEFAULT 0 NOT NULL,
	`tokens` integer DEFAULT 0 NOT NULL,
	`at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`agent_id`) REFERENCES `agent`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `cost_ws_idx` ON `cost_entry` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `cron_job` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`task` text NOT NULL,
	`agent_id` text,
	`at` text DEFAULT '00:00' NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`agent_id`) REFERENCES `agent`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `cron_run` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`task` text NOT NULL,
	`agent_id` text,
	`at` integer DEFAULT (unixepoch()) NOT NULL,
	`ok` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`agent_id`) REFERENCES `agent`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `decision` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`goal_id` text,
	`text` text NOT NULL,
	`rationale` text DEFAULT '' NOT NULL,
	`by` text DEFAULT '' NOT NULL,
	`source` text DEFAULT '' NOT NULL,
	`ref_key` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `decision_ws_idx` ON `decision` (`workspace_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `doc_index` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`kind` text NOT NULL,
	`path` text NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `docidx_ws_path_idx` ON `doc_index` (`workspace_id`,`path`);--> statement-breakpoint
CREATE TABLE `event` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`run_id` text NOT NULL,
	`channel` text DEFAULT 'room' NOT NULL,
	`agent_id` text,
	`seq` integer NOT NULL,
	`kind` text NOT NULL,
	`target` text DEFAULT '' NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`agent_id`) REFERENCES `agent`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `event_chan_seq_idx` ON `event` (`workspace_id`,`channel`,`seq`);--> statement-breakpoint
CREATE INDEX `event_run_idx` ON `event` (`run_id`);--> statement-breakpoint
CREATE TABLE `file` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`path` text NOT NULL,
	`lang` text DEFAULT 'ts' NOT NULL,
	`content` text DEFAULT '' NOT NULL,
	`git_status` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `file_ws_path_idx` ON `file` (`workspace_id`,`path`);--> statement-breakpoint
CREATE TABLE `finding` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`sev` text DEFAULT 'med' NOT NULL,
	`title` text NOT NULL,
	`file` text DEFAULT '' NOT NULL,
	`suggestion` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `goal` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`owner_id` text,
	`progress` integer DEFAULT 0 NOT NULL,
	`parent_id` text,
	`status` text DEFAULT 'active' NOT NULL,
	`spec_id` text,
	`archive_path` text DEFAULT '' NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	`done_at` integer,
	`cancelled_at` integer,
	`archived_at` integer,
	`reopened_at` integer,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`owner_id`) REFERENCES `agent`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `goal_ws_idx` ON `goal` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `goal_file` (
	`workspace_id` text NOT NULL,
	`goal_id` text NOT NULL,
	`path` text NOT NULL,
	`op` text DEFAULT 'edit' NOT NULL,
	`at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`goal_id`, `path`),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `inbox_item` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`kind` text DEFAULT 'approval' NOT NULL,
	`title` text NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`from_agent_id` text,
	`resolved` integer DEFAULT false NOT NULL,
	`ref_type` text,
	`ref_id` text,
	`goal_id` text,
	`channel` text,
	`message_id` text,
	`created_at` integer,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`from_agent_id`) REFERENCES `agent`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `issue` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`spec_id` text,
	`goal_id` text,
	`key` text NOT NULL,
	`title` text NOT NULL,
	`prio` text DEFAULT 'med' NOT NULL,
	`col` text DEFAULT 'todo' NOT NULL,
	`moscow` text,
	`points` integer DEFAULT 0 NOT NULL,
	`assignee_id` text,
	`approved` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`spec_id`) REFERENCES `spec`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assignee_id`) REFERENCES `agent`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `local_model` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`file` text NOT NULL,
	`quant` text DEFAULT 'Q4_K_M' NOT NULL,
	`params` text DEFAULT '' NOT NULL,
	`size_bytes` integer DEFAULT 0 NOT NULL,
	`sha256` text DEFAULT '' NOT NULL,
	`bind` text DEFAULT '127.0.0.1:8080' NOT NULL,
	`loaded` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `member` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'owner' NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `message` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`channel` text DEFAULT 'room' NOT NULL,
	`from_kind` text NOT NULL,
	`from_handle` text,
	`text` text NOT NULL,
	`sources` text,
	`attachments` text,
	`session_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `msg_ws_chan_idx` ON `message` (`workspace_id`,`channel`);--> statement-breakpoint
CREATE TABLE `message_summary` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`channel` text NOT NULL,
	`session_id` text,
	`summary` text DEFAULT '' NOT NULL,
	`through_id` text DEFAULT '' NOT NULL,
	`msg_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `msgsum_ws_chan_idx` ON `message_summary` (`workspace_id`,`channel`);--> statement-breakpoint
CREATE TABLE `notification` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`kind` text DEFAULT 'info' NOT NULL,
	`text` text NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`agent_id` text,
	`message_id` text,
	`channel` text DEFAULT '' NOT NULL,
	`read` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`agent_id`) REFERENCES `agent`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `notif_ws_idx` ON `notification` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `notification_pref` (
	`user_id` text PRIMARY KEY NOT NULL,
	`email` integer DEFAULT true NOT NULL,
	`telegram` integer DEFAULT true NOT NULL,
	`inapp` integer DEFAULT true NOT NULL,
	`weekly` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `organization` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`owner_id` text NOT NULL,
	`run_mode` text DEFAULT 'start' NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `passkey` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text DEFAULT 'Passkey' NOT NULL,
	`credential_id` text NOT NULL,
	`public_key` text NOT NULL,
	`counter` integer DEFAULT 0 NOT NULL,
	`device_type` text DEFAULT '' NOT NULL,
	`backed_up` integer DEFAULT false NOT NULL,
	`transports` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `passkey_credential_id_unique` ON `passkey` (`credential_id`);--> statement-breakpoint
CREATE INDEX `passkey_user_idx` ON `passkey` (`user_id`);--> statement-breakpoint
CREATE TABLE `personal_access_token` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`scope` text DEFAULT 'read' NOT NULL,
	`token_hash` text NOT NULL,
	`prefix` text NOT NULL,
	`last_used_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `pat_user_idx` ON `personal_access_token` (`user_id`);--> statement-breakpoint
CREATE TABLE `plan` (
	`workspace_id` text PRIMARY KEY NOT NULL,
	`approved` integer DEFAULT false NOT NULL,
	`auto_247` integer DEFAULT false NOT NULL,
	`stage` integer DEFAULT 4 NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `plugin` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`enabled` integer DEFAULT false NOT NULL,
	`native` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `provider` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`catalog_id` text NOT NULL,
	`adapter` text NOT NULL,
	`kind` text DEFAULT 'cloud' NOT NULL,
	`auth` text DEFAULT 'api_key' NOT NULL,
	`status` text DEFAULT 'needs_sync' NOT NULL,
	`sync_status` text DEFAULT 'not_implemented' NOT NULL,
	`model_count` integer DEFAULT 0 NOT NULL,
	`last_sync` integer,
	`cli_version` text,
	`default_model` text,
	`auth_state` text,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `provider_ws_idx` ON `provider` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `provider_model` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`catalog_id` text NOT NULL,
	`model_id` text NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`context` integer DEFAULT 0 NOT NULL,
	`output_limit` integer DEFAULT 0 NOT NULL,
	`input_cost` real DEFAULT 0 NOT NULL,
	`output_cost` real DEFAULT 0 NOT NULL,
	`caps` text,
	`released` text DEFAULT '' NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`last_seen` integer,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`provider_id`) REFERENCES `provider`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `provider_model_prov_idx` ON `provider_model` (`provider_id`);--> statement-breakpoint
CREATE TABLE `pulse` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`agent_id` text NOT NULL,
	`at` integer DEFAULT (unixepoch()) NOT NULL,
	`ok` integer DEFAULT true NOT NULL,
	`latency_ms` integer DEFAULT 0 NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`agent_id`) REFERENCES `agent`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `pulse_agent_idx` ON `pulse` (`agent_id`);--> statement-breakpoint
CREATE TABLE `rag_chunk` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`path` text NOT NULL,
	`chunk` text NOT NULL,
	`vector` text,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `rag_ws_idx` ON `rag_chunk` (`workspace_id`,`path`);--> statement-breakpoint
CREATE TABLE `report` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`title` text NOT NULL,
	`type` text DEFAULT 'Report' NOT NULL,
	`author_id` text,
	`body` text DEFAULT '' NOT NULL,
	`goal_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `agent`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `routine` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`agent_id` text,
	`cmd` text DEFAULT '' NOT NULL,
	`freq` text DEFAULT 'Daily' NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`agent_id`) REFERENCES `agent`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`active_org_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE TABLE `skill` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`instructions` text DEFAULT '' NOT NULL,
	`trigger` text DEFAULT '' NOT NULL,
	`native` integer DEFAULT false NOT NULL,
	`provisional` integer DEFAULT false NOT NULL,
	`indexed` text DEFAULT 'pending' NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `skill_ws_idx` ON `skill` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `spec` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`key` text NOT NULL,
	`title` text NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`author_id` text,
	`body` text DEFAULT '' NOT NULL,
	`approved` integer DEFAULT false NOT NULL,
	`goal_id` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `agent`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `task` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`key` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`col` text DEFAULT 'triage' NOT NULL,
	`prio` text DEFAULT 'med' NOT NULL,
	`assignee_id` text,
	`goal_id` text,
	`issue_id` text,
	`created_by` text DEFAULT 'operator' NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`assignee_id`) REFERENCES `agent`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`goal_id`) REFERENCES `goal`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`issue_id`) REFERENCES `issue`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `task_ws_idx` ON `task` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `task_step` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`task_id` text NOT NULL,
	`text` text NOT NULL,
	`done` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT false NOT NULL,
	`ord` integer DEFAULT 0 NOT NULL,
	`created_at` integer,
	`updated_at` integer,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `task`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `task_step_idx` ON `task_step` (`task_id`);--> statement-breakpoint
CREATE TABLE `test_run` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`goal_id` text,
	`issue_id` text,
	`status` text DEFAULT 'running' NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`findings` text DEFAULT '[]' NOT NULL,
	`by` text DEFAULT 'operator' NOT NULL,
	`started_at` integer,
	`finished_at` integer,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `test_run_ws_idx` ON `test_run` (`workspace_id`);--> statement-breakpoint
CREATE TABLE `two_factor` (
	`id` text PRIMARY KEY NOT NULL,
	`secret` text NOT NULL,
	`backup_codes` text NOT NULL,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `twofactor_user_idx` ON `two_factor` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`two_factor_enabled` integer DEFAULT false NOT NULL,
	`address_as` text DEFAULT '' NOT NULL,
	`lang` text DEFAULT 'English (US)' NOT NULL,
	`tz` text DEFAULT 'UTC' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `vault` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`provider_id` text,
	`ref` text NOT NULL,
	`ciphertext` text NOT NULL,
	`iv` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspace`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`provider_id`) REFERENCES `provider`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workspace` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`mission` text DEFAULT '' NOT NULL,
	`objective` text DEFAULT '' NOT NULL,
	`stack` text DEFAULT '{}' NOT NULL,
	`run_mode` text DEFAULT 'start' NOT NULL,
	`bootstrap` text DEFAULT 'template-only' NOT NULL,
	`settings` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`org_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_slug_unique` ON `workspace` (`slug`);