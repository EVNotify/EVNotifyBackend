/**
 * @file modules/sync/index.js
 * @author GPlay97
 * @description Sync module to allow syncing of several properties
 */
const srv_config = require('./../../srv_config.json'),
    srv_errors = require('./../../srv_errors.json'),
    db = require('./../db'),
    token = require('./../token');

/**
 * Updates the current state of charge value within database and adds statistic record
 * @param {String} akey the AKey
 * @param {Number} soc the state of charge to set
 * @param {Function} callback callback function
 */
const postSoC = (akey, soc, callback) => {
    const now = parseInt(new Date() / 1000);

    db.query('UPDATE stats SET curSoC=?, lastSoC=? WHERE akey=?', [
        soc, now, akey
    ], (err, dbRes) => {
        if (!err && dbRes) {
            db.query('INSERT INTO statistics (akey, type, value, timestamp) VALUES (?, ?, ?, ?)', [
                akey, 'soc', soc, now
            ], (err, dbRes) => callback(err, (!err && dbRes)));
        } else callback(err);
    });
};

/**
 * Retrieves the last submitted state of charge value and timestamp from database
 * @param {String} akey the AKey
 * @param {Function} callback callback function
 */
const getSoC = (akey, callback) => {
    db.query('SELECT curSoC, lastSoC FROM stats WHERE akey=?', [
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
        // check required params // TODO validation of soc (+float within db template?)
        if (!req.body.akey || !req.body.token || !req.body.soc) {
            return res.status(400).json({
                error: srv_errors.INVALID_PARAMETERS
            });
        }
        // validate token
        token.validateToken(req.body.akey, req.body.token, (err, valid) => {
            if (!err) {
                if (valid) {
                    postSoC(req.body.akey, req.body.soc, (err, synced) => {
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
    /**
     * getSoC request handler
     * @param {Object} req the server request
     * @param {Object} res the server response
     */
    getSoC: (req, res) => {
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
                            res.json({
                                soc: socObj.curSoC,
                                timestamp: socObj.lastSoC
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
    }
};