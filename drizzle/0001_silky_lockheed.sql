CREATE TABLE `subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`channelId` varchar(255) NOT NULL,
	`channelName` varchar(255) NOT NULL,
	`channelThumbnail` text,
	`addedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `subscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `summaries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`videoId` varchar(255) NOT NULL,
	`userId` int NOT NULL,
	`summary` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `summaries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `userSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`email` varchar(320) NOT NULL,
	`emailEnabled` int NOT NULL DEFAULT 1,
	`summaryFrequency` enum('daily','weekly') NOT NULL DEFAULT 'daily',
	`lastEmailSent` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `userSettings_id` PRIMARY KEY(`id`),
	CONSTRAINT `userSettings_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `videos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`videoId` varchar(255) NOT NULL,
	`channelId` varchar(255) NOT NULL,
	`title` varchar(500) NOT NULL,
	`description` text,
	`publishedAt` timestamp NOT NULL,
	`thumbnailUrl` text,
	`duration` varchar(50),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `videos_id` PRIMARY KEY(`id`),
	CONSTRAINT `videos_videoId_unique` UNIQUE(`videoId`)
);
