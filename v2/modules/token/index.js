/**
 * @file modules/token/index.js
 * @author GPlay97
 * @description Token module to call specific token related functions
 */
const db = require('./../db'),
    crypto = require('crypto'),
    srv_config = require('./../../srv_config.json'),
    srv_errors = require('./../../srv_errors.json'),
    account = require('./../account');

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

const renewToken = (akey, token, password, callback) => {
    // authenticate first
    account.loginFunction(akey, password, (err, dbToken) => {
        if (!err && dbToken) {
            // compare token
            if (dbToken === token) {
                let newToken = crypto.randomBytes(10).toString('hex');

                // generate new token and update within database
                db.query('UPDATE accounts SET token=? WHERE akey=?', [
                    newToken, akey
                ], (err, dbRes) => callback(err, ((!err && dbRes) ? newToken : null)));
            } else callback(srv_errors.INVALID_TOKEN)
        } else callback(err);
    });
};

module.exports = {
    validateToken,
    /**
     * renewToken request handler
     * @param {Object} req the server request
     * @param {Object} res the server response
     */
    renewToken: (req, res) => {
        // validate params
        if (!req.body.akey || !req.body.token || typeof req.body.password !== 'string') {
            return res.status(400).json({
                error: srv_errors.INVALID_PARAMETERS
            });
        }
        // renew token
        renewToken(req.body.akey, req.body.token, req.body.password, (err, token) => {
            if (!err && typeof token === 'string') {
                res.json({
                    token
                });
            } else {
                res.status(422).json({
                    error: srv_errors.UNPROCESSABLE_ENTITY,
                    debug: ((srv_config.DEBUG) ? err : null)
                });
            }
        });
    }
};