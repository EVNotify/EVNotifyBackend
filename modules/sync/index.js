/**
 * @file modules/sync/index.js
 * @author GPlay97
 * @description Sync module to allow syncing of several properties
 */
const srv_config = require('./../../srv_config.json'),
    srv_errors = require('./../../srv_errors.json'),
    db = require('./../db'),
    abrp = require('./../integrations/abrp'),
    webhook = require('./../webhook'),
    token = require('./../token'),
    telemetry = require('./telemetry');

const updatedRecently = (now, dbTimestamp) => now - 5 < dbTimestamp;

/**
 * Updates the current state of charge value within database and adds statistic record
 * @param {String} akey the AKey
 * @param {Object} socObj the state of charge object containing display and/or bms soc value to set
 * @param {Function} callback callback function
 */
const postSoC = (akey, socObj, callback) => {
    const now = parseInt(new Date() / 1000);

    db.query('SELECT last_soc FROM sync WHERE akey=?', [
        akey,
    ], (err, queryRes) => {
        if (!err && queryRes) {
            const lastSoc = queryRes[0] ? queryRes[0].last_soc : 0;

            db.query('UPDATE sync SET soc_display=?, soc_bms=?, last_soc=? WHERE akey=?', [
                socObj.display, socObj.bms, now, akey
            ], (err, dbRes) => {
                if (!err && dbRes) {
                    if (updatedRecently(now, lastSoc)) {
                        callback(err, (!err && dbRes));
                        return;
                    }

                    abrp.submitData(akey);
                    db.query('INSERT INTO statistics (akey, soc_display, soc_bms, timestamp) VALUES (?, ?, ?, ?)', [
                        akey, socObj.display, socObj.bms, now
                    ], (err, dbRes) => callback(err, (!err && dbRes)));
                } else callback(err);
            });
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
    const now = parseInt(new Date() / 1000);
    const supplied = telemetry.supplied(extendedObj);
    const columns = supplied.map(field => telemetry.fields[field]);
    const values = supplied.map(field => telemetry.storedValue(extendedObj, field));

    db.query('SELECT last_extended FROM sync WHERE akey=?', [akey], (err, queryRes) => {
        if (err || !queryRes) return callback(err);
        const lastExtended = queryRes[0] ? queryRes[0].last_extended : 0;
        const assignments = columns.concat(['last_extended']).map(column => column + '=?');

        db.query('UPDATE sync SET ' + assignments.join(', ') + ' WHERE akey=?',
            values.concat([now, akey]), err => {
                if (err) return callback(err);
                if (updatedRecently(now, lastExtended)) return callback(null, true);

                // History contains only this submission, never retained current values.
                const historyColumns = columns.concat(['timestamp', 'akey']);
                db.query('INSERT INTO statistics (' + historyColumns.join(', ') + ') VALUES (' +
                    historyColumns.map(() => '?').join(', ') + ')', values.concat([now, akey]),
                    (err, dbRes) => callback(err, (!err && dbRes)));
            });
    });
};

/**
 * Retrieves the last submitted extended sync values and timestamp from database
 * @param {String} akey the AKey
 * @param {Function} callback callback function
 */
const getExtended = (akey, callback) => {
    const columns = Object.keys(telemetry.fields).map(field => telemetry.fields[field]).concat(['last_extended']);
    db.query('SELECT ' + columns.join(', ') + ' FROM sync WHERE akey=?', [akey],
        (err, queryRes) => callback(err, ((!err && queryRes) ? telemetry.serialize(queryRes[0]) : null)));
};

/**
 * Updates the current location with current gps speed within database and adds statistic records for them
 * @param {String} akey the AKey
 * @param {Object} locationObj the location object containing latitude, longitude and speed
 * @param {Function} callback callback function
 */
const postLocation = (akey, locationObj, callback) => {
    const now = parseInt(new Date() / 1000);

    db.query('SELECT last_location FROM sync WHERE akey=?', [
        akey,
    ], (err, queryRes) => {
        if (!err && queryRes) {
            const lastLocation = queryRes[0] ? queryRes[0].last_location : 0;

            db.query('UPDATE sync SET latitude=?, longitude=?, gps_speed=?, accuracy=?, location_timestamp=?, last_location=? WHERE akey=?', [
                locationObj.latitude, locationObj.longitude, locationObj.speed, locationObj.accuracy, locationObj.timestamp, now, akey
            ], err => {
                if (!err) {
                    if (updatedRecently(now, lastLocation)) {
                        callback(null, true);
                        return;
                    }

                    db.query('INSERT INTO statistics (latitude, longitude, gps_speed, accuracy, location_timestamp, timestamp, akey) VALUES (?, ?, ?, ?, ?, ?, ?)', [
                        locationObj.latitude, locationObj.longitude, locationObj.speed, locationObj.accuracy, locationObj.timestamp, now, akey
                    ], (err, dbRes) => callback(err, (!err && dbRes)));
                } else callback(err);
            });
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
                            webhook.emit(req.body.akey, req.body.token, 'soc', {
                                display: req.body.display,
                                bms: req.body.bms
                            });
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
        // Validate the entire submission before any telemetry writes.
        if (!req.body.akey || !req.body.token || !telemetry.valid(req.body)) {
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
                            webhook.emit(req.body.akey, req.body.token, 'extended', req.body);
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
        if (!req.body.akey || !req.body.token || req.body.location == null || typeof req.body.location !== 'object') {
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
                            webhook.emit(req.body.akey, req.body.token, 'location', req.body.location);
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
