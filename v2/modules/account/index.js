/**
 * @file modules/account/index.js
 * @author GPlay97
 * @description Module for login and registration
 */
const crypto = require('crypto'),
    bcrypt = require('bcrypt'),
    errors = require('./../../srv_errors.json'),
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
                res.status(409).json({
                    error: errors.DB_QUERY
                });
            }
        });
    }
};