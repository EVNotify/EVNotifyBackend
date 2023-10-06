/**
 * @file modules/web/account/index.js
 * @author GPlay97
 * @description Account module for web interface
 */
const web = require('./../index.js');
const db = require('./../../db');
const bcrypt = require('bcrypt');
const srv_config = require('./../../../srv_config.json');
const srv_errors = require('./../../../srv_errors.json');
const encryption = require('./../../encryption');

/**
 * Registers account for given mail and password
 * @param {String} mail the mail to register
 * @param {String} password the password to use
 * @param {Function} callback callback function
 */
const register = (mail, password, callback) => {
    // check if mail is already in use
    db.query('SELECT mail FROM login', [], (err, userRes) => {
        if (!err && Array.isArray(userRes)) {
            if (userRes.some(user => {
                    return encryption.decrypt(user.mail) === mail;
                })) {
                // already registered
                return callback(srv_errors.MAIL_ALREADY_REGISTERED);
            }
            // generate password hash
            bcrypt.hash(password, 10, (err, pwdHash) => {
                if (!err && pwdHash) {
                    // register account
                    db.query('INSERT INTO login (mail, pw_hash) VALUES (?, ?)', [
                        encryption.encrypt(mail), pwdHash
                    ], (err, dbRes) => {
                        if (!err && dbRes) callback(null, dbRes.insertId);
                        else callback(err);
                    });
                } else callback(srv_errors.HASH_FAILED);
            });
        } else callback(err);
    });
};

/**
 * Login account with given mail and password
 * @param {String} mail the mail
 * @param {String} password the password for the mail
 * @param {Function} callback callback function
 */
const login = (mail, password, callback) => {
    // get user
    db.query('SELECT id, mail, pw_hash FROM login', [], (err, userRes) => {
        if (!err && userRes) {
            let userObj = {};

            if (!userRes.some(user => {
                    if (encryption.decrypt(user.mail) === mail) {
                        userObj = user;
                        return true;
                    }
                    return false;
                })) {
                // not found
                return callback(srv_errors.USER_NOT_EXISTING);
            }
            // compare password
            bcrypt.compare(password, userObj.pw_hash, (err, valid) => {
                if (!err && valid) {
                    // update last login timestamp
                    db.query('UPDATE login SET last_login=? WHERE id=?', [
                        Math.floor(Date.now() / 1000), userObj.id
                    ], (err, dbRes) => callback(err, ((!err && dbRes) ? userObj.id : null)));
                } else callback(((err) ? err : srv_errors.INVALID_CREDENTIALS));
            });
        } else callback(err);
    });
};

module.exports = {
    /**
     * register request handler
     * @param {Object} req the server request
     * @param {Object} res the server response
     */
    register: (req, res) => {
        if (web.validateMail(req.body.mail) && req.body.password && req.body.password.length >= 6) {
            register(req.body.mail, req.body.password, (err, id) => {
                if (!err && id) {
                    req.session.user = id;
                    res.json({
                        id
                    });
                } else {
                    res.status(422).json({
                        error: ((err === srv_errors.MAIL_ALREADY_REGISTERED) ? srv_errors.MAIL_ALREADY_REGISTERED : srv_errors.UNPROCESSABLE_ENTITY),
                        debug: ((srv_config.DEBUG) ? err : null)
                    });
                }
            });
        } else {
            res.status(400).json({
                error: srv_errors.INVALID_PARAMETERS
            });
        }
    },
    /**
     * login request handler
     * @param {Object} req the server request
     * @param {Object} res the server request
     */
    login: (req, res) => {
        if (web.validateMail(req.body.mail) && req.body.password && req.body.password.length >= 6) {
            login(req.body.mail, req.body.password, (err, id) => {
                if (!err && id) {
                    req.session.id = id;
                    res.json({
                        id
                    });
                } else {
                    res.status(422).json({
                        error: ((err === srv_errors.USER_NOT_EXISTING) ?
                            srv_errors.USER_NOT_EXISTING : ((err === srv_errors.INVALID_CREDENTIALS) ?
                                srv_errors.INVALID_CREDENTIALS : srv_errors.UNPROCESSABLE_ENTITY
                            )
                        ),
                        debug: ((srv_config.DEBUG) ? err : null)
                    });
                }
            });
        } else {
            res.status(400).json({
                error: srv_errors.INVALID_PARAMETERS
            });
        }
    }
};
