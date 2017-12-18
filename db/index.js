var srv_config = require('./../srv_config.json'),
    mysql = require('mysql'),
    db = mysql.createPool({
        host     : srv_config.DB_HOST,
        user     : srv_config.DB_USER,
        password : srv_config.DB_PW,
        database : srv_config.DB_DB
    });

/**
 * Function which gets db instance to prevent multiple declaration of mysql pools
 * @return {object}     the db instance
 */
exports.getPool = function() {
    return db;
};
