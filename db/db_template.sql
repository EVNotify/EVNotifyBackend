-- database creation
CREATE DATABASE IF NOT EXISTS `evnotify_test`;
USE `evnotify_test`;
-- accounts table structure
CREATE TABLE IF NOT EXISTS `accounts` (
    `akey` VARCHAR(6) NOT NULL PRIMARY KEY,
    `pw_hash` VARCHAR(255) NOT NULL,
    `token` VARCHAR(20) NOT NULL UNIQUE
);

-- settings table structure
CREATE TABLE IF NOT EXISTS `settings` (
    `user` VARCHAR(6) NOT NULL,
    `akey` VARCHAR(6) NOT NULL,
    `email` VARCHAR(100) DEFAULT NULL,
    `telegram` INT(100) DEFAULT 0,
    `soc` INT(3) DEFAULT 70,
    `lng` VARCHAR(20) DEFAULT 'en',
    `push` TINYINT(1) DEFAULT 0,
    `device` VARCHAR(100) DEFAULT NULL,
    `polling` INT(4) DEFAULT 30,
    `autoSync` INT(4) DEFAULT 30,
    PRIMARY KEY (`user`),
    FOREIGN KEY (`akey`) REFERENCES `accounts`(`akey`)
);

-- stats table structure
CREATE TABLE IF NOT EXISTS `stats` (
    `user` VARCHAR(6) NOT NULL,
    `akey` VARCHAR(6) NOT NULL,
    `curSoC` INT(3) DEFAULT 0,
    `lastSoC` INT(13) DEFAULT 0,
    PRIMARY KEY (`user`),
    FOREIGN KEY (`akey`) REFERENCES `accounts`(`akey`)
);

-- debug table structure
CREATE TABLE IF NOT EXISTS `debug` (
    `id` int NOT NULL AUTO_INCREMENT,
    `data` MEDIUMTEXT DEFAULT NULL,
    `timestamp` int(10) DEFAULT 0,
    PRIMARY KEY (`id`)
);
