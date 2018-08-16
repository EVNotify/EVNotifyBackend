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
 * NOTE: If display or bms value missing, the other corresponding value will be used for that missing property
 * @param {String} akey the AKey
 * @param {Object} socObj the state of charge object containing display and/or bms soc value to set
 * @param {Function} callback callback function
 */
const postSoC = (akey, socObj, callback) => {
    const now = parseInt(new Date() / 1000);

    let soc;
    
    // if missing, use general soc
    if (typeof socObj.display === 'undefined') soc = socObj.bms;
    else if (typeof socObj.bms === 'undefined') soc = socObj.display;

    db.query('UPDATE sync SET soc_display=?, soc_bms=?, last_soc=? WHERE akey=?', [
        soc || socObj.display, soc || socObj.bms, now, akey
    ], (err, dbRes) => {
        if (!err && dbRes) {
            db.query('INSERT INTO statistics (akey, type, value, timestamp) VALUES (?, ?, ?, ?)', [
                akey, 'soc', ((typeof socObj.display !== 'undefined')? socObj.display : socObj.bms), now
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

module.exports = {
    /**
     * postSoC request handler
     * @param {Object} req the server request
     * @param {Object} res the server response
     */
    postSoC: (req, res) => {
        // check required params
        if (!req.body.akey || !req.body.token || (typeof req.body.display === 'undefined' && typeof req.body.bms === 'undefined') ||
            !(((typeof req.body.display !== 'undefined') ? typeof req.body.display === 'number' && !isNaN(req.body.display) : true)) ||
            !(((typeof req.body.bms !== 'undefined') ? typeof req.body.bms === 'number' && !isNaN(req.body.bms) : true))) {
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
    }
};