CREATE TABLE `attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`ticket_id` text NOT NULL,
	`uploader_id` text NOT NULL,
	`file_name` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`storage_key` text NOT NULL,
	`visibility` text DEFAULT 'internal' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`uploader_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attachments_storage_key_unique` ON `attachments` (`storage_key`);--> statement-breakpoint
ALTER TABLE `organization_settings` ADD `max_attachment_bytes` integer DEFAULT 26214400 NOT NULL;--> statement-breakpoint
ALTER TABLE `organization_settings` ADD `allowed_attachment_types` text DEFAULT '["application/pdf","image/png","image/jpeg","text/plain","text/csv","application/zip"]' NOT NULL;