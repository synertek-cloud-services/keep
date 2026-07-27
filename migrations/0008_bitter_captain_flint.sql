CREATE TABLE `organization_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`timezone` text DEFAULT 'UTC' NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `organization_settings` (`id`, `timezone`, `updated_at`)
VALUES ('organization-default', 'America/Los_Angeles', unixepoch());
