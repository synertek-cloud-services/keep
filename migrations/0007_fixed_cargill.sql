ALTER TABLE `tickets` ADD `contract_id` text REFERENCES contracts(id);--> statement-breakpoint
ALTER TABLE `time_entries` ADD `contract_id` text REFERENCES contracts(id);--> statement-breakpoint
ALTER TABLE `time_entries` ADD `contract_billing_model` text;--> statement-breakpoint
ALTER TABLE `time_entries` ADD `contract_rate_cents` integer;