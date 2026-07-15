CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`room` text NOT NULL,
	`sender_id` text NOT NULL,
	`cipher_text` text NOT NULL,
	`iv` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `messages_room_time_idx` ON `messages` (`room`,`created_at`);