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
 * Validates paramaters and sends message to user back and returns whether params were valid
 * @param {Object} req the server request
 * @param {Object} res the server response
 * @returns {Boolean} whether or not params are valid
 */
const validParams = (req, res) => {
    // check required params
    if (!req.body.akey || typeof req.body.akey !== 'string' ||
        !req.body.password || typeof req.body.password !== 'string') {
        res.status(400).json({
            error: srv_errors.INVALID_PARAMETERS
        });
        return false;
    }
    // validate akey
    if (req.body.akey.length !== 6) {
        res.status(400).json({
            error: srv_errors.MALFORMED_AKEY
        });
        return false;
    }
    // validate password
    if (req.body.password.length < 6 || req.body.password.length > 72) {
        res.status(400).json({
            error: srv_errors.MALFORMED_PASSWORD
        });
        return false;
    }
    return true;
};

/**
 * Registers an account for given AKey and password, creates linked table entries 
 * and token that will be attached to callback
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
                                    db.query('INSERT INTO sync (user, akey) VALUES (?, ?)', [
                                        akey, akey
                                    ], (err, dbRes) => {
                                        if (!err && dbRes) callback(null, token);
                                        else callback(err);
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

/**
 * Logins the user if existing and password matches to attach token within callback
 * @param {String} akey the AKey to login
 * @param {String} password the password to use
 * @param {Function} callback callback function
 */
const login = (akey, password, callback) => {
    db.query('SELECT akey, pw_hash, token FROM accounts WHERE akey=?', [akey], (err, dbRes) => {
        if (!err && Array.isArray(dbRes)) {
            if (!dbRes.length) return callback(srv_errors.USER_NOT_EXISTING);
            // compare the hash
            bcrypt.compare(password, dbRes[0].pw_hash, (err, valid) => callback(((err || !valid)? err || srv_errors.INVALID_CREDENTIALS : null), ((valid) ? dbRes[0].token : null)));
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
        // validate params
        if (!validParams(req, res)) return;
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
    },
    /**
     * login request handler
     * @param {Object} req the server request
     * @param {Object} res the server response
     */
    login: (req, res) => {
        // validate params
        if (!validParams(req, res)) return;
        // login
        login(req.body.akey, req.body.password, (err, token) => {
            if (!err && token) {
                // login succeeded
                res.json({
                    token
                });
            } else if (!err) {
                // invalid credentials
                res.status(401).json({
                    error: srv_errors.INVALID_CREDENTIALS
                });
            } else {
                // user not exists or unprocessable
                res.status(422).json({
                    error: ((err === srv_errors.USER_NOT_EXISTING) ?
                        srv_errors.USER_NOT_EXISTING : srv_errors.UNPROCESSABLE_ENTITY
                    ),
                    debug: ((srv_config.DEBUG) ? err : null)
                });
            }
        });
    },
    /**
     * login exported function
     */
    loginFunction: login
};