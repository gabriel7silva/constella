ALTER TABLE `agent` ADD `connection_mode` text DEFAULT 'cli' NOT NULL;--> statement-breakpoint
ALTER TABLE `agent` ADD `gateway_handle` text;