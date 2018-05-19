-- accounts table structure
CREATE TABLE IF NOT EXISTS `accounts` (
    `akey` VARCHAR(6) NOT NULL PRIMARY KEY,
    `pw_hash` VARCHAR(255) NOT NULL,
    `lastactivity` INT(10) DEFAULT 0,
    `token` VARCHAR(20) NOT NULL UNIQUE
);

-- settings table structure
CREATE TABLE IF NOT EXISTS `settings` (
    `user` VARCHAR(6) NOT NULL,
    `akey` VARCHAR(6) NOT NULL,
    `email` VARCHAR(100) DEFAULT NULL,
    `telegram` INT(100) DEFAULT 0,
    `summary` TINYINT(1) DEFAULT 0,
    `soc` INT(3) DEFAULT 70,
    `lng` VARCHAR(20) DEFAULT 'en',
    `push` TINYINT(1) DEFAULT 0,
    `consumption` FLOAT(99, 2) DEFAULT 13,
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
    `lastNotification` INT(13) DEFAULT 0,
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

-- statistics table structure
CREATE TABLE IF NOT EXISTS `statistics` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `akey` VARCHAR(6) NOT NULL,
    `type` VARCHAR(36) DEFAULT NULL,
    `value` MEDIUMTEXT DEFAULT NULL,
    `timestamp` INT(10) DEFAULT 0,
    PRIMARY KEY (`id`),
    FOREIGN KEY (`akey`) REFERENCES `accounts`(`akey`),
    KEY `akey2` (`akey`) USING BTREE,
    KEY `type` (`type`) USING BTREE,
    KEY `timestamp` (`timestamp`) USING BTREE
);
