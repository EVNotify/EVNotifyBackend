/**
 * @file modules/token/index.js
 * @author GPlay97
 * @description Token module to call specific token related functions
 */
const db = require('./../db');

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

module.exports = {
    validateToken
};