/**
 * @file modules/sync/index.js
 * @author GPlay97
 * @description Sync module to allow syncing of several properties
 */
const srv_config = require('./../../srv_config.json'),
    srv_errors = require('./../../srv_errors.json'),
    db = require('./../db'),
    abrp = require('./../integrations/abrp'),
    token = require('./../token');

/**
 * Updates the current state of charge value within database and adds statistic record
 * @param {String} akey the AKey
 * @param {Object} socObj the state of charge object containing display and/or bms soc value to set
 * @param {Function} callback callback function
 */
const postSoC = (akey, socObj, callback) => {
    const now = Math.floor(Date.now() / 1000);

    db.query('UPDATE sync SET soc_display=?, soc_bms=?, last_soc=? WHERE akey=?', [
        socObj.display, socObj.bms, now, akey
    ], (err, dbRes) => {
        if (!err && dbRes) {
            abrp.submitData(akey);
            db.query('INSERT INTO statistics (akey, soc_display, soc_bms, timestamp) VALUES (?, ?, ?, ?)', [
                akey, socObj.display, socObj.bms, now
            ], (err, dbRes) => callback(err, (!err && dbRes)));
        } else callback(err);
    });
};

/**
 * Retrieves the last submitted state of charge values and timestamp from database
 * @param {String} akey the AKey
 * @param {Function} callback callback function
 */
const getSoC = (akey, callback) => {
    db.query('SELECT soc_display, soc_bms, last_soc FROM sync WHERE akey=?', [
        akey
    ], (err, queryRes) => callback(err, ((!err && queryRes) ? queryRes[0] : null)));
};

/**
 * Updates extended sync properties within database and adds statistic records
 * @param {String} akey the AKey
 * @param {Object} extendedObj the object containing the properties to sync
 * @param {Function} callback callback function
 */
const postExtended = (akey, extendedObj, callback) => {
    const now = Math.floor(Date.now() / 1000);


    db.query('UPDATE sync SET soh=?, charging=?, rapid_charge_port=?, normal_charge_port=?, slow_charge_port=?, aux_battery_voltage=?, dc_battery_voltage=?, dc_battery_current=?, dc_battery_power=?,\
    cumulative_energy_charged=?, cumulative_energy_discharged=?, battery_min_temperature=?, battery_max_temperature=?, battery_inlet_temperature=?, external_temperature=?, odo=?, last_extended=? WHERE akey=?', [
        extendedObj.soh, extendedObj.charging, extendedObj.rapidChargePort, extendedObj.normalChargePort, extendedObj.slowChargePort, extendedObj.auxBatteryVoltage, extendedObj.dcBatteryVoltage, extendedObj.dcBatteryCurrent,
        extendedObj.dcBatteryPower, extendedObj.cumulativeEnergyCharged, extendedObj.cumulativeEnergyDischarged, extendedObj.batteryMinTemperature, extendedObj.batteryMaxTemperature, extendedObj.batteryInletTemperature, extendedObj.externalTemperature, extendedObj.odo, now, akey
    ], err => {
        if (!err) {
            db.query('INSERT INTO statistics (soh, charging, rapid_charge_port, normal_charge_port, slow_charge_port, aux_battery_voltage, dc_battery_voltage, \
            dc_battery_current, dc_battery_power, cumulative_energy_charged, cumulative_energy_discharged, battery_min_temperature, battery_max_temperature, battery_inlet_temperature, external_temperature, odo, timestamp, akey) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
                extendedObj.soh, extendedObj.charging, extendedObj.rapidChargePort, extendedObj.normalChargePort, extendedObj.slowChargePort, extendedObj.auxBatteryVoltage, extendedObj.dcBatteryVoltage, extendedObj.dcBatteryCurrent,
                extendedObj.dcBatteryPower, extendedObj.cumulativeEnergyCharged, extendedObj.cumulativeEnergyDischarged, extendedObj.batteryMinTemperature, extendedObj.batteryMaxTemperature, extendedObj.batteryInletTemperature, extendedObj.externalTemperature, extendedObj.odo, now, akey
            ], (err, dbRes) => callback(err, (!err && dbRes)));
        } else callback(err);
    });
};

/**
 * Retrieves the last submitted extended sync values and timestamp from database
 * @param {String} akey the AKey
 * @param {Function} callback callback function
 */
const getExtended = (akey, callback) => {
    db.query('SELECT soh, charging, rapid_charge_port, normal_charge_port, slow_charge_port, aux_battery_voltage, dc_battery_voltage, dc_battery_current, dc_battery_power, \
    cumulative_energy_charged, cumulative_energy_discharged, battery_min_temperature, battery_max_temperature, battery_inlet_temperature, external_temperature, odo, last_extended FROM sync WHERE akey=?', [
        akey
    ], (err, queryRes) => callback(err, ((!err && queryRes) ? queryRes[0] : null)));
};

/**
 * Updates the current location with current gps speed within database and adds statistic records for them
 * @param {String} akey the AKey
 * @param {Object} locationObj the location object containing latitude, longitude and speed
 * @param {Function} callback callback function
 */
const postLocation = (akey, locationObj, callback) => {
    const now = Math.floor(Date.now() / 1000);

    db.query('UPDATE sync SET latitude=?, longitude=?, gps_speed=?, accuracy=?, location_timestamp=?, last_location=? WHERE akey=?', [
        locationObj.latitude, locationObj.longitude, locationObj.speed, locationObj.accuracy, locationObj.timestamp, now, akey
    ], err => {
        if (!err) {
            db.query('INSERT INTO statistics (latitude, longitude, gps_speed, accuracy, location_timestamp, timestamp, akey) VALUES (?, ?, ?, ?, ?, ?, ?)', [
                locationObj.latitude, locationObj.longitude, locationObj.speed, locationObj.accuracy, locationObj.timestamp, now, akey
            ], (err, dbRes) => callback(err, (!err && dbRes)));
        } else callback(err);
    });
};

/**
 * Retrieves last submitted location and timestamp from database
 * @param {String} akey the AKey
 * @param {Function} callback callback function
 */
const getLocation = (akey, callback) => {
    db.query('SELECT latitude, longitude, gps_speed, accuracy, location_timestamp, last_location FROM sync WHERE akey=?', [
        akey
    ], (err, queryRes) => callback(err, ((!err && queryRes) ? queryRes[0] : null)));
};

module.exports = {
    /**
     * postSoC request handler
     * @param {Object} req the server request
     * @param {Object} res the server response
     */
    postSoC: (req, res) => {
        // check required params
        if (!req.body.akey || !req.body.token || (typeof req.body.display === 'undefined' && typeof req.body.bms === 'undefined')) {
            return res.status(400).json({
                error: srv_errors.INVALID_PARAMETERS
            });
        }
        // validate token
        token.validateToken(req.body.akey, req.body.token, (err, valid) => {
            if (!err) {
                if (valid) {
                    postSoC(req.body.akey, {
                        display: req.body.display,
                        bms: req.body.bms
                    }, (err, synced) => {
                        if (!err && synced) {
                            res.json({
                                synced: true
                            });
                        } else {
                            res.status(422).json({
                                error: srv_errors.UNPROCESSABLE_ENTITY,
                                debug: ((srv_config.DEBUG) ? err : null)
                            });
                        }
                    });
                } else {
                    // invalid token
                    res.status(401).json({
                        error: srv_errors.INVALID_TOKEN
                    });
                }
            } else {
                res.status(422).json({
                    error: srv_errors.UNPROCESSABLE_ENTITY,
                    debug: ((srv_config.DEBUG) ? err : null)
                });
            }
        });
    },
    /**
     * getSoC request handler
     * @param {Object} req the server request
     * @param {Object} res the server response
     */
    getSoC: (req, res) => {
        // validate required params
        if (!req.query.akey || !req.query.token) {
            return res.status(400).json({
                error: srv_errors.INVALID_PARAMETERS
            });
        }
        // validate token
        token.validateToken(req.query.akey, req.query.token, (err, valid) => {
            if (!err) {
                if (valid) {
                    getSoC(req.query.akey, (err, socObj) => {
                        if (!err && socObj != null) {
                            res.json(socObj);
                        } else {
                            res.status(422).json({
                                error: srv_errors.UNPROCESSABLE_ENTITY,
                                debug: ((srv_config.DEBUG) ? err : null)
                            });
                        }
                    });
                } else {
                    // invalid token
                    res.status(401).json({
                        error: srv_errors.INVALID_TOKEN
                    });
                }
            } else {
                res.status(422).json({
                    error: srv_errors.UNPROCESSABLE_ENTITY,
                    debug: ((srv_config.DEBUG) ? err : null)
                });
            }
        });
    },
    postExtended: (req, res) => {
        // check required params
        if (!req.body.akey || !req.body.token) {
            return res.status(400).json({
                error: srv_errors.INVALID_PARAMETERS
            });
        }
        // validate token
        token.validateToken(req.body.akey, req.body.token, (err, valid) => {
            if (!err) {
                if (valid) {
                    postExtended(req.body.akey, req.body, (err, synced) => {
                        if (!err && synced) {
                            res.json({
                                synced
                            });
                        } else {
                            res.status(422).json({
                                error: srv_errors.UNPROCESSABLE_ENTITY,
                                debug: ((srv_config.DEBUG) ? err : null)
                            });
                        }
                    });
                } else {
                    // invalid token
                    res.status(401).json({
                        error: srv_errors.INVALID_TOKEN
                    });
                }
            } else {
                res.status(422).json({
                    error: srv_errors.UNPROCESSABLE_ENTITY,
                    debug: ((srv_config.DEBUG) ? err : null)
                });
            }
        });
    },
    getExtended: (req, res) => {
        // check required params
        if (!req.query.akey || !req.query.token) {
            return res.status(400).json({
                error: srv_errors.INVALID_PARAMETERS
            });
        }
        // validate token
        token.validateToken(req.query.akey, req.query.token, (err, valid) => {
            if (!err) {
                if (valid) {
                    getExtended(req.query.akey, (err, extendedObj) => {
                        if (!err && extendedObj != null) {
                            res.json(extendedObj);
                        } else {
                            res.status(422).json({
                                error: srv_errors.UNPROCESSABLE_ENTITY,
                                debug: ((srv_config.DEBUG) ? err : null)
                            });
                        }
                    });
                } else {
                    // invalid token
                    res.status(401).json({
                        error: srv_errors.INVALID_TOKEN
                    });
                }
            } else {
                res.status(422).json({
                    error: srv_errors.UNPROCESSABLE_ENTITY,
                    debug: ((srv_config.DEBUG) ? err : null)
                });
            }
        });
    },
    /**
     * postLocation request handler
     * @param {Object} req the server request
     * @param {Object} res the server response
     */
    postLocation: (req, res) => {
        // check required params
        if (!req.body.akey || !req.body.token || !req.body.location == null || typeof req.body.location !== 'object') {
            return res.status(400).json({
                error: srv_errors.INVALID_PARAMETERS
            });
        }
        // validate token
        token.validateToken(req.body.akey, req.body.token, (err, valid) => {
            if (!err) {
                if (valid) {
                    postLocation(req.body.akey, req.body.location, (err, synced) => {
                        if (!err && synced) {
                            res.json({
                                synced: true
                            });
                        } else {
                            res.status(422).json({
                                error: srv_errors.UNPROCESSABLE_ENTITY,
                                debug: ((srv_config.DEBUG) ? err : null)
                            });
                        }
                    });
                } else {
                    // invalid token
                    res.status(401).json({
                        error: srv_errors.INVALID_TOKEN
                    });
                }
            } else {
                res.status(422).json({
                    error: srv_errors.UNPROCESSABLE_ENTITY,
                    debug: ((srv_config.DEBUG) ? err : null)
                });
            }
        });
    },
    /**
     * getLocation request handler
     * @param {Object} req the server request
     * @param {Object} res the server response
     */
    getLocation: (req, res) => {
        // validate required params
        if (!req.query.akey || !req.query.token) {
            return res.status(400).json({
                error: srv_errors.INVALID_PARAMETERS
            });
        }
        // validate token
        token.validateToken(req.query.akey, req.query.token, (err, valid) => {
            if (!err) {
                if (valid) {
                    getLocation(req.query.akey, (err, locationObj) => {
                        if (!err && locationObj != null) {
                            res.json(locationObj);
                        } else {
                            res.status(422).json({
                                error: srv_errors.UNPROCESSABLE_ENTITY,
                                debug: ((srv_config.DEBUG) ? err : null)
                            });
                        }
                    });
                } else {
                    // invalid token
                    res.status(401).json({
                        error: srv_errors.INVALID_TOKEN
                    });
                }
            } else {
                res.status(422).json({
                    error: srv_errors.UNPROCESSABLE_ENTITY,
                    debug: ((srv_config.DEBUG) ? err : null)
                });
            }
        });
    }
};
