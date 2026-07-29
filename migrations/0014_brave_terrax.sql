DROP INDEX `tickets_ingest_dedup`;--> statement-breakpoint
CREATE UNIQUE INDEX `tickets_ingest_dedup` ON `tickets` (`ingest_api_key_id`,`external_ref`) WHERE "tickets"."status" != 'closed';