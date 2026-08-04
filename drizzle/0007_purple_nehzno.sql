CREATE TABLE `newsletters` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`topic` varchar(64) NOT NULL DEFAULT 'ai-trends',
	`title` varchar(500) NOT NULL,
	`weekStart` timestamp NOT NULL,
	`weekEnd` timestamp NOT NULL,
	`content` mediumtext NOT NULL,
	`videoCount` int NOT NULL DEFAULT 0,
	`emailSentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `newsletters_id` PRIMARY KEY(`id`),
	CONSTRAINT `newsletters_user_topic_week_idx` UNIQUE(`userId`,`topic`,`weekStart`)
);
