/**
 * @file modules/account/index.js
 * @author GPlay97
 * @description Module for login and registration
 */
const crypto = require('crypto'),
    bcrypt = require('bcrypt'),
    srv_config = require('./../../srv_config.json'),
    srv_errors = require('./../../srv_errors.json'),
    db = require('./../db');

/**
 * Generates random key and checks if key currently exists
 * @param {Function} callback callback function
 */
const getKey = (callback) => {
    const key = crypto.randomBytes(3).toString('hex');

    db.query('SELECT akey FROM accounts WHERE akey=?', [key], (err, dbRes) => {
        if (!err && Array.isArray(dbRes)) {
            if (dbRes.length) getKey(callback);
            else callback(null, key);
        } else callback(err);
    });
};

/**
 * Registers an account for given AKey and password and creates linked table entries
 * @param {String} akey the AKey to register
 * @param {String} password the password to use
 * @param {Function} callback callback function
 */
const register = (akey, password, callback) => {
    // search the database to detect if account already exists
    db.query('SELECT akey FROM accounts WHERE akey=?', [akey], (err, dbRes) => {
        if (!err && Array.isArray(dbRes)) {
            if (dbRes.length) return callback(srv_errors.ALREADY_REGISTERED);
            // generate a password hash
            bcrypt.hash(password, 10, (err, pwdHash) => {
                if (!err && pwdHash) {
                    const token = crypto.randomBytes(10).toString('hex');

                    // register the account
                    db.query('INSERT INTO accounts (akey, pw_hash, token) VALUES (?,?, ?)', [
                        akey, pwdHash, token
                    ], (err, dbRes) => {
                        if (!err && dbRes) {
                            // create records for linked tables to ensure that they exists later
                            db.query('INSERT INTO settings (user, akey) VALUES (?, ?)', [
                                akey, akey
                            ], (err, dbRes) => {
                                if (!err && dbRes) {
                                    db.query('INSERT INTO stats (user, akey) VALUES (?, ?)', [
                                        akey, akey
                                    ], (err, dbRes) => {
                                        if (!err && dbRes) {
                                            callback(null, {
                                                token
                                            });
                                        } else callback(err);
                                    });
                                } else callback(err);
                            });
                        } else callback(err);
                    });
                } else callback(srv_errors.HASH_FAILED);
            });
        } else callback(err);
    });
};

module.exports = {
    /**
     * getKey request handler
     * @param {Object} req the server request
     * @param {Object} res the server response
     */
    getKey: (req, res) => {
        // get a key that is currently available
        getKey((err, akey) => {
            if (!err && akey) {
                res.json({
                    akey
                });
            } else {
                res.status(422).json({
                    error: srv_errors.DB_QUERY,
                    debug: ((srv_config.DEBUG) ? err : null)
                });
            }
        });
    },
    /**
     * register request handler
     * @param {Object} req the server request
     * @param {Object} res the server response
     */
    register: (req, res) => {
        // check required params
        if (!req.body.akey || typeof req.body.akey !== 'string' ||
            !req.body.password || typeof req.body.password !== 'string') {
            return res.status(400).json({
                error: srv_errors.INVALID_PARAMETERS
            });
        }
        // validate akey
        if (req.body.akey.length !== 6) return res.status(400).json({
            error: srv_errors.MALFORMED_AKEY
        });
        // validate password
        if (req.body.password.length < 6 || req.body.password.length > 72) return res.status(400).json({
            error: srv_errors.MALFORMED_PASSWORD
        });
        // register a new account
        register(req.body.akey, req.body.password, (err, token) => {
            if (!err && token) {
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