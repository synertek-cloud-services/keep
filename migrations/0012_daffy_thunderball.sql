CREATE TABLE `resource_roles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`is_active` integer DEFAULT true NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`hourly_rate_cents` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `resource_roles_one_default` ON `resource_roles` (`is_default`) WHERE "resource_roles"."is_default" = 1;--> statement-breakpoint
CREATE TABLE `user_resource_roles` (
	`user_id` text NOT NULL,
	`resource_role_id` text NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	PRIMARY KEY(`user_id`, `resource_role_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`resource_role_id`) REFERENCES `resource_roles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_resource_roles_one_default` ON `user_resource_roles` (`user_id`) WHERE "user_resource_roles"."is_default" = 1;--> statement-breakpoint
CREATE TABLE `work_types` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`code` text,
	`description` text,
	`is_active` integer DEFAULT true NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`billable_by_default` integer DEFAULT true NOT NULL,
	`minimum_billable_minutes` integer DEFAULT 0 NOT NULL,
	`rounding_minutes` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `work_types_one_default` ON `work_types` (`is_default`) WHERE "work_types"."is_default" = 1;--> statement-breakpoint
ALTER TABLE `organization_settings` ADD `business_days` text DEFAULT '[1,2,3,4,5]' NOT NULL;--> statement-breakpoint
ALTER TABLE `organization_settings` ADD `business_start_minute` integer DEFAULT 480 NOT NULL;--> statement-breakpoint
ALTER TABLE `organization_settings` ADD `business_end_minute` integer DEFAULT 1080 NOT NULL;--> statement-breakpoint
ALTER TABLE `organization_settings` ADD `time_entry_increment_minutes` integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE `organization_settings` ADD `billing_rounding_minutes` integer DEFAULT 15 NOT NULL;--> statement-breakpoint
ALTER TABLE `organization_settings` ADD `allow_billing_offset` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `time_entries` ADD `work_type_id` text REFERENCES work_types(id);--> statement-breakpoint
ALTER TABLE `time_entries` ADD `resource_role_id` text REFERENCES resource_roles(id);--> statement-breakpoint
ALTER TABLE `time_entries` ADD `work_type_name` text;--> statement-breakpoint
ALTER TABLE `time_entries` ADD `resource_role_name` text;--> statement-breakpoint
ALTER TABLE `time_entries` ADD `resource_role_rate_cents` integer;--> statement-breakpoint
ALTER TABLE `time_entries` ADD `minimum_billable_minutes` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `time_entries` ADD `billing_rounding_minutes` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `time_entries` ADD `billable_minutes` integer;--> statement-breakpoint
INSERT INTO `work_types` (`id`, `name`, `code`, `description`, `is_active`, `is_default`, `billable_by_default`, `minimum_billable_minutes`, `rounding_minutes`, `created_at`, `updated_at`)
VALUES ('work-type-standard-support', 'Standard Support', 'STANDARD', 'Default customer support work.', 1, 1, 1, 0, NULL, unixepoch(), unixepoch());--> statement-breakpoint
INSERT INTO `resource_roles` (`id`, `name`, `description`, `is_active`, `is_default`, `hourly_rate_cents`, `created_at`, `updated_at`)
VALUES ('resource-role-technician', 'Technician', 'Default service technician role.', 1, 1, 0, unixepoch(), unixepoch());--> statement-breakpoint
INSERT INTO `user_resource_roles` (`user_id`, `resource_role_id`, `is_default`)
SELECT `id`, 'resource-role-technician', 1 FROM `users`;--> statement-breakpoint
UPDATE `time_entries`
SET `work_type_id` = 'work-type-standard-support',
	`resource_role_id` = 'resource-role-technician',
	`work_type_name` = 'Standard Support',
	`resource_role_name` = 'Technician',
	`resource_role_rate_cents` = 0,
	`billable_minutes` = max(0, `duration_minutes` + `billing_offset_minutes`);
