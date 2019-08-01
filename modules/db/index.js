/**
 * @file modules/db/index.js
 * @author GPlay97
 * @description Database module
 */
const mysql = require('mysql'),
    srv_config = require('./../../srv_config.json'),
    srv_errors = require('./../../srv_errors.json'),
    db = mysql.createPool({
        host: srv_config.DB_HOST,
        user: srv_config.DB_USER,
        password: srv_config.DB_PW,
        database: srv_config.DB_DB
    });

module.exports = {
    /**
     * Queries the database for given sql string and parameters
     * It automatically escapes the sql string through binding with given parameters
     * @example db.query('SELECT id FROM foo WHERE bar=?', ['foobar'], (err, queryRes) => console.log(err, queryRes));
     * @param {String} sql the sql string
     * @param {Array} params Array of values to bind to parameters ('?' within sql string)
     * @param {Function} callback callback function
     */
    query: (sql, params, callback) => {
        if (typeof params === 'function') callback = params;
        if (!Array.isArray(params)) params = [];
        if (typeof sql === 'string') {
            if (params.length > 0 && Array.isArray(params[0])) {
                return db.query(sql, params, callback);
            } else {
                return db.query(mysql.format(sql, params), callback);
            }
        } else if (typeof callback === 'function') callback(srv_errors.INVALID_PARAMETERS);
    },
    /**
     * Gets a database connection from the pool. Requested connections have to be released manually!
     */
    getConnection: (callback) => {
        db.getConnection(callback);
    },
    close: callback => db.end(callback),
};