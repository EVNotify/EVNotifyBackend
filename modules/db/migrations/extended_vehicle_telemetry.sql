-- Run with a selected database using the mysql CLI (DELIMITER is a CLI command).
-- Pause both archive jobs first. DDL commits implicitly; take a backup beforehand.
-- Adds missing columns only; existing measurements are never backfilled.
DROP PROCEDURE IF EXISTS evnotify_extend_vehicle_telemetry;
DELIMITER //
CREATE PROCEDURE evnotify_extend_vehicle_telemetry()
BEGIN
    DECLARE finished INT DEFAULT 0;
    DECLARE target_table VARCHAR(64);
    DECLARE field_index INT;
    DECLARE field_name VARCHAR(64);
    DECLARE field_type VARCHAR(32);
    DECLARE column_exists INT;
    DECLARE base_tables INT;
    DECLARE targets CURSOR FOR
        SELECT TABLE_NAME FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'
          AND TABLE_NAME REGEXP '^(sync|statistics|statistics_[0-9]{1,2}_[0-9]{4}|statistics_log_[0-9]+)$';
    DECLARE CONTINUE HANDLER FOR NOT FOUND SET finished = 1;

    SELECT COUNT(*) INTO base_tables FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'
      AND TABLE_NAME IN ('sync', 'statistics');
    IF base_tables <> 2 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Select an EVNotify database containing sync and statistics';
    END IF;

    OPEN targets;
    table_loop: LOOP
        FETCH targets INTO target_table;
        IF finished THEN LEAVE table_loop; END IF;
        SET field_index = 0;
        WHILE field_index < 4 DO
            SET field_name = CASE field_index
                WHEN 0 THEN 'battery_cell_voltage_min'
                WHEN 1 THEN 'battery_cell_voltage_max'
                WHEN 2 THEN 'battery_cell_voltage_delta'
                ELSE 'battery_fan_speed' END;
            SET field_type = IF(field_index = 3, 'FLOAT', 'DECIMAL(12,6)');
            SELECT COUNT(*) INTO column_exists FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = target_table AND COLUMN_NAME = field_name;
            IF column_exists = 0 THEN
                SET @telemetry_ddl = CONCAT('ALTER TABLE `', target_table, '` ADD COLUMN `',
                    field_name, '` ', field_type, ' NULL DEFAULT NULL');
                PREPARE telemetry_statement FROM @telemetry_ddl;
                EXECUTE telemetry_statement;
                DEALLOCATE PREPARE telemetry_statement;
            END IF;
            SET field_index = field_index + 1;
        END WHILE;
    END LOOP;
    CLOSE targets;

    -- Retain odometer type and all stored values, including existing zeros.
    ALTER TABLE sync ALTER COLUMN odo SET DEFAULT NULL;
END//
DELIMITER ;
CALL evnotify_extend_vehicle_telemetry();
DROP PROCEDURE evnotify_extend_vehicle_telemetry;
