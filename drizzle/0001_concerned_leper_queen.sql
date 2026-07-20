CREATE TABLE `messages_v3` (
	`id` text PRIMARY KEY NOT NULL,
	`room` text NOT NULL,
	`cipher_text` text NOT NULL,
	`iv` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `messages_v3_room_idx` ON `messages_v3` (`room`);