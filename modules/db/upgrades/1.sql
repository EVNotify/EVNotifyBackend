CREATE TABLE IF NOT EXISTS `system` (
    `key` VARCHAR(20) NOT NULL PRIMARY KEY,
    `value` VARCHAR(20) NOT NULL
);

CREATE TABLE IF NOT EXISTS `notificationMail` (
    `akey` VARCHAR(6) NOT NULL PRIMARY KEY,
    `mail` VARCHAR(1000) NOT NULL,
    `verified` BOOLEAN NOT NULL DEFAULT FALSE,
    `identifier` BINARY(16) NOT NULL,
    UNIQUE KEY (`identifier`),
    FOREIGN KEY (`akey`) REFERENCES `accounts`(`akey`)
);

CREATE TABLE IF NOT EXISTS `mailLock` (
    `hash` BINARY(32) NOT NULL PRIMARY KEY,
    `time` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `weight` INTEGER NOT NULL DEFAULT 1
);

INSERT INTO `notificationMail` SELECT `akey`,`email`,TRUE,UNHEX(MD5(RAND())) FROM `settings` WHERE email IS NOT NULL;

ALTER TABLE `settings`DROP COLUMN `email`;

INSERT INTO `system` VALUES("version", 1);