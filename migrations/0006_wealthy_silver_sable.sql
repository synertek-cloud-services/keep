CREATE TABLE `contracts` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`type` text DEFAULT 'recurring' NOT NULL,
	`billing_model` text DEFAULT 'included_hours' NOT NULL,
	`start_date` integer NOT NULL,
	`end_date` integer,
	`fixed_fee_cents` integer DEFAULT 0 NOT NULL,
	`included_minutes` integer DEFAULT 0 NOT NULL,
	`hourly_rate_cents` integer DEFAULT 0 NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contracts_one_default_per_company` ON `contracts` (`company_id`) WHERE "contracts"."is_default" = 1;