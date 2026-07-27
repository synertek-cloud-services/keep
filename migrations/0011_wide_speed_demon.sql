ALTER TABLE `tickets` ADD `estimated_minutes` integer;--> statement-breakpoint
ALTER TABLE `time_entries` ADD `billing_offset_minutes` integer DEFAULT 0 NOT NULL;