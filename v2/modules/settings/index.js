/**
 * @file modules/settings/index.js
 * @author GPlay97
 * @description Settings module to retrieve or update settings
 */
const srv_config = require('./../../srv_config.json'),
    srv_errors = require('./../../srv_errors.json'),
    db = require('./../db'),
    encryption = require('./../encryption');

/**
 * Fetches token from database for given akey and compares it with given token
 * @param {String} akey the akey
 * @param {String} token the token of the akey to validate
 * @param {Function} callback callback function
 */
const validateToken = (akey, token, callback) => {
    db.query('SELECT token FROM accounts WHERE akey=?', [akey], (err, dbRes) => {
        callback(err, (!err && dbRes && dbRes[0] && dbRes[0].token === token));
    });
};

/**
 * Retrieves settings from database for given akey
 * @param {String} akey the akey from where to get the settings
 * @param {Function} callback callback function
 */
const getSettings = (akey, callback) => {
    db.query('SELECT email, telegram, soc, consumption, car, device, lng, summary FROM settings WHERE akey=?', [
        akey
    ], (err, dbRes) => {
        if (!err && dbRes && dbRes[0] && dbRes[0].email) dbRes[0].email = encryption.decrypt(dbRes[0].email);
        callback(err, ((!err && dbRes && dbRes[0]) ? dbRes[0] : null));
    });
};

/**
 * Sets the settings for given akey and given settings object
 * @param {String} akey the akey where to set the settings
 * @param {Object} settings the settings object to set
 * @param {Function} callback callback function
 */
const setSettings = (akey, settings, callback) => {
    db.query('UPDATE settings SET email=?, telegram=?, soc=?, consumption=?, car=?, device=?, lng=?, summary=? WHERE akey=?', [
        encryption.encrypt(settings.email),
        settings.telegram,
        settings.soc,
        settings.consumption,
        settings.car,
        settings.device,
        settings.lng,
        settings.summary,
        akey
    ], (err, dbRes) => callback(err, ((!err && dbRes && dbRes[0]) ? dbRes[0] : null)));
};

module.exports = {
    /**
     * getSettings request handler
     * @param {Object} req the server request
     * @param {Object} res the server response
     */
    getSettings: (req, res) => {
        // check required params
        if (!req.query.akey || !req.query.token) {
            return res.status(400).json({
                error: srv_errors.INVALID_PARAMETERS
            });
        }
        // validate token
        validateToken(req.query.akey, req.query.token, (err, valid) => {
            if (!err) {
                if (valid) {
                    // retrieve the settings
                    getSettings(req.query.akey, (err, settings) => {
                        if (!err && settings != null) {
                            res.json({
                                settings
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
     * setSettings request handler
     * @param {Object} req the server request
     * @param {Object} res the server response
     */
    setSettings: (req, res) => {
        // check required params
        if (!req.body.akey || !req.body.token || typeof req.body.settings !== 'object' || req.body.settings == null) {
            return res.status(400).json({
                error: srv_errors.INVALID_PARAMETERS
            });
        }
        // validate token
        validateToken(req.body.akey, req.body.token, (err, valid) => {
            if (!err) {
                if (valid) {
                    // set settings
                    setSettings(req.body.akey, req.body.settings, (err, settings) => {
                        if (!err) {
                            res.json({
                                settings: req.body.settings
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