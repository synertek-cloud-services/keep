CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`key_hash` text NOT NULL,
	`default_issue_type_id` text,
	`default_sub_issue_type_id` text,
	`created_at` integer NOT NULL,
	`last_used_at` integer,
	`revoked_at` integer,
	`created_by` text,
	FOREIGN KEY (`default_issue_type_id`) REFERENCES `issue_types`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`default_sub_issue_type_id`) REFERENCES `sub_issue_types`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_key_hash_unique` ON `api_keys` (`key_hash`);--> statement-breakpoint
CREATE TABLE `companies` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT 'client' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`sla_policy_id` text DEFAULT 'sla-standard' NOT NULL,
	`default_billable` integer DEFAULT true NOT NULL,
	`external_ref` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`sla_policy_id`) REFERENCES `sla_policies`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `companies_external_ref_unique` ON `companies` (`external_ref`);--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`phone` text,
	`is_primary` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `dashboard_widgets` (
	`id` text PRIMARY KEY NOT NULL,
	`dashboard_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text,
	`config` text DEFAULT '{}' NOT NULL,
	`grid_x` integer DEFAULT 0 NOT NULL,
	`grid_y` integer DEFAULT 0 NOT NULL,
	`grid_w` integer DEFAULT 4 NOT NULL,
	`grid_h` integer DEFAULT 3 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`dashboard_id`) REFERENCES `dashboards`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `dashboards` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`is_default` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `issue_types` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notes` (
	`id` text PRIMARY KEY NOT NULL,
	`ticket_id` text NOT NULL,
	`resource_id` text NOT NULL,
	`body` text NOT NULL,
	`visibility` text DEFAULT 'internal' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`resource_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `queues` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `routing_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`issue_type_id` text NOT NULL,
	`sub_issue_type_id` text,
	`target_queue_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`issue_type_id`) REFERENCES `issue_types`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sub_issue_type_id`) REFERENCES `sub_issue_types`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`target_queue_id`) REFERENCES `queues`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sla_policies` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`triage_minutes` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sla_policy_priorities` (
	`policy_id` text NOT NULL,
	`priority` text NOT NULL,
	`response_minutes` integer NOT NULL,
	`resolution_minutes` integer NOT NULL,
	PRIMARY KEY(`policy_id`, `priority`),
	FOREIGN KEY (`policy_id`) REFERENCES `sla_policies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `sso_exchange_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`session_token` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sso_group_role_mappings` (
	`id` text PRIMARY KEY NOT NULL,
	`sso_provider_id` text NOT NULL,
	`group_id` text NOT NULL,
	`group_name` text,
	`role` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`sso_provider_id`) REFERENCES `sso_providers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sso_login_state` (
	`id` text PRIMARY KEY NOT NULL,
	`sso_provider_id` text NOT NULL,
	`code_verifier` text NOT NULL,
	`redirect_uri` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`sso_provider_id`) REFERENCES `sso_providers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sso_providers` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text DEFAULT 'microsoft' NOT NULL,
	`name` text NOT NULL,
	`directory_id` text NOT NULL,
	`client_id` text NOT NULL,
	`client_secret_ciphertext` text NOT NULL,
	`client_secret_nonce` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sub_issue_types` (
	`id` text PRIMARY KEY NOT NULL,
	`issue_type_id` text NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`issue_type_id`) REFERENCES `issue_types`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `ticket_counters` (
	`year` integer PRIMARY KEY NOT NULL,
	`next_number` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tickets` (
	`id` text PRIMARY KEY NOT NULL,
	`ticket_number` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'triage' NOT NULL,
	`priority` text,
	`priority_source` text,
	`issue_type_id` text,
	`sub_issue_type_id` text,
	`queue_id` text NOT NULL,
	`assigned_resource_id` text,
	`company_id` text NOT NULL,
	`contact_id` text,
	`source` text DEFAULT 'manual' NOT NULL,
	`needs_tech_attention` integer DEFAULT false NOT NULL,
	`escalated_at` integer,
	`triage_due_at` integer,
	`sla_clock_started_at` integer,
	`response_due_at` integer,
	`first_response_at` integer,
	`resolution_due_at` integer,
	`resolved_at` integer,
	`closed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`created_by` text,
	`ingest_api_key_id` text,
	`external_ref` text,
	FOREIGN KEY (`issue_type_id`) REFERENCES `issue_types`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`sub_issue_type_id`) REFERENCES `sub_issue_types`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`queue_id`) REFERENCES `queues`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`assigned_resource_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ingest_api_key_id`) REFERENCES `api_keys`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tickets_ticket_number_unique` ON `tickets` (`ticket_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `tickets_ingest_dedup` ON `tickets` (`ingest_api_key_id`,`external_ref`);--> statement-breakpoint
CREATE TABLE `time_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`ticket_id` text NOT NULL,
	`resource_id` text NOT NULL,
	`duration_minutes` integer NOT NULL,
	`notes` text,
	`work_date` integer NOT NULL,
	`billable` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`resource_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `user_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`last_used_at` integer,
	`revoked_at` integer,
	`user_agent` text,
	`ip` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_sessions_token_hash_unique` ON `user_sessions` (`token_hash`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text,
	`role` text DEFAULT 'tech' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`password_hash` text,
	`auth_source` text DEFAULT 'local' NOT NULL,
	`sso_provider_id` text,
	`sso_subject` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`last_login_at` integer,
	FOREIGN KEY (`sso_provider_id`) REFERENCES `sso_providers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);
--> statement-breakpoint
-- ─────────────────────────────────────────────────────────────────────────
-- Baseline seed data — hand-appended after `drizzle-kit generate`, which
-- only emits DDL. Fixed deterministic IDs so app code (e.g. the default
-- sla_policy_id on companies) can reference them without a lookup. This is
-- required-on-first-run data per the v1 spec (dashboard not empty, every
-- Company has a valid SLA policy), not demo/sample data — see AGENTS.md.
-- ─────────────────────────────────────────────────────────────────────────

-- "Standard" SLA policy — the default every Company gets on creation.
INSERT INTO `sla_policies` (`id`, `name`, `triage_minutes`, `created_at`, `updated_at`) VALUES
	('sla-standard', 'Standard', 30, unixepoch(), unixepoch());
--> statement-breakpoint
INSERT INTO `sla_policy_priorities` (`policy_id`, `priority`, `response_minutes`, `resolution_minutes`) VALUES
	('sla-standard', 'critical', 15, 240),
	('sla-standard', 'high', 30, 480),
	('sla-standard', 'medium', 120, 1440),
	('sla-standard', 'low', 240, 4320);
--> statement-breakpoint

-- Issue-type taxonomy (Computer / Server / Network / SecOps + sub-types).
INSERT INTO `issue_types` (`id`, `name`, `sort_order`, `created_at`) VALUES
	('issue-computer', 'Computer', 0, unixepoch()),
	('issue-server', 'Server', 1, unixepoch()),
	('issue-network', 'Network', 2, unixepoch()),
	('issue-secops', 'SecOps', 3, unixepoch());
--> statement-breakpoint
INSERT INTO `sub_issue_types` (`id`, `issue_type_id`, `name`, `sort_order`, `created_at`) VALUES
	('sub-computer-hardware', 'issue-computer', 'Hardware', 0, unixepoch()),
	('sub-computer-software', 'issue-computer', 'Software', 1, unixepoch()),
	('sub-computer-peripherals', 'issue-computer', 'Peripherals', 2, unixepoch()),
	('sub-computer-user-management', 'issue-computer', 'User Management', 3, unixepoch()),
	('sub-server-active-directory', 'issue-server', 'Active Directory', 0, unixepoch()),
	('sub-server-dns', 'issue-server', 'DNS', 1, unixepoch()),
	('sub-server-dhcp', 'issue-server', 'DHCP', 2, unixepoch()),
	('sub-server-software', 'issue-server', 'Software', 3, unixepoch()),
	('sub-server-user-management', 'issue-server', 'User Management', 4, unixepoch()),
	('sub-network-wifi', 'issue-network', 'Wi-Fi', 0, unixepoch()),
	('sub-network-vpn', 'issue-network', 'VPN', 1, unixepoch()),
	('sub-network-firewall', 'issue-network', 'Firewall', 2, unixepoch()),
	('sub-network-switching-routing', 'issue-network', 'Switching/Routing', 3, unixepoch()),
	('sub-network-internet-isp', 'issue-network', 'Internet/ISP', 4, unixepoch()),
	('sub-secops-av-malware-alert', 'issue-secops', 'AV/Malware Alert', 0, unixepoch()),
	('sub-secops-anomalous-logon', 'issue-secops', 'Anomalous Logon', 1, unixepoch()),
	('sub-secops-account-lockout', 'issue-secops', 'Account Lockout', 2, unixepoch()),
	('sub-secops-phishing-report', 'issue-secops', 'Phishing Report', 3, unixepoch()),
	('sub-secops-access-permissions-change', 'issue-secops', 'Access/Permissions Change', 4, unixepoch()),
	('sub-secops-data-loss-exfiltration', 'issue-secops', 'Data Loss/Exfiltration', 5, unixepoch());
--> statement-breakpoint

-- Default "General" queue — every ticket has somewhere to land before any
-- Routing Rules exist.
INSERT INTO `queues` (`id`, `name`, `created_at`, `updated_at`) VALUES
	('queue-general', 'General', unixepoch(), unixepoch());
--> statement-breakpoint

-- Default dashboard + the 10-widget starter layout (12-column grid: Big
-- Number row, Chart row, List row), so the Dashboards module is never an
-- empty canvas on first run.
INSERT INTO `dashboards` (`id`, `name`, `is_default`, `created_at`, `updated_at`) VALUES
	('default-dashboard', 'Overview', 1, unixepoch(), unixepoch());
--> statement-breakpoint
INSERT INTO `dashboard_widgets` (`id`, `dashboard_id`, `type`, `title`, `config`, `grid_x`, `grid_y`, `grid_w`, `grid_h`, `sort_order`, `created_at`, `updated_at`) VALUES
	('widget-unassigned-count', 'default-dashboard', 'unassigned_count', 'Unassigned Tickets', '{}', 0, 0, 3, 2, 0, unixepoch(), unixepoch()),
	('widget-untriaged-count', 'default-dashboard', 'untriaged_count', 'Untriaged Tickets', '{}', 3, 0, 3, 2, 1, unixepoch(), unixepoch()),
	('widget-sla-breaches-today', 'default-dashboard', 'sla_breaches_today', 'SLA Breaches Today', '{}', 6, 0, 3, 2, 2, unixepoch(), unixepoch()),
	('widget-needs-attention-count', 'default-dashboard', 'needs_attention_count', 'Needs Attention', '{}', 9, 0, 3, 2, 3, unixepoch(), unixepoch()),
	('widget-open-by-status', 'default-dashboard', 'open_by_status', 'Open Tickets by Status', '{}', 0, 2, 4, 5, 4, unixepoch(), unixepoch()),
	('widget-open-by-priority', 'default-dashboard', 'open_by_priority', 'Open Tickets by Priority', '{}', 4, 2, 4, 5, 5, unixepoch(), unixepoch()),
	('widget-open-by-queue', 'default-dashboard', 'open_by_queue', 'Open Tickets by Queue', '{}', 8, 2, 4, 5, 6, unixepoch(), unixepoch()),
	('widget-oldest-open-tickets', 'default-dashboard', 'oldest_open_tickets', 'Oldest Open Tickets', '{}', 0, 7, 4, 6, 7, unixepoch(), unixepoch()),
	('widget-tickets-per-tech', 'default-dashboard', 'tickets_per_tech', 'Tickets per Tech', '{}', 4, 7, 4, 6, 8, unixepoch(), unixepoch()),
	('widget-sla-at-risk-tickets', 'default-dashboard', 'sla_at_risk_tickets', 'SLA At-Risk Tickets', '{}', 8, 7, 4, 6, 9, unixepoch(), unixepoch());