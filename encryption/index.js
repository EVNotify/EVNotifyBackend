var crypto = require('crypto'),
    srv_config = require('./../srv_config.json'),
    algorithm = 'aes-256-ctr',
    encryptionKey = srv_config.ENCRYPTION_KEY;

/**
 * Function which allows to encrypt specified data
 * @param  {String} data    The data to encrypt
 * @return {String|Boolean} The encrypted data or false, if invalid data
 */
exports.encrypt = function(data) {
    if(typeof data !== 'string') return false;

    var cipher = crypto.createCipher(algorithm,encryptionKey),
        crypted = cipher.update(data,'utf8','hex');

    return crypted += cipher.final('hex');
};

/**
 * Function which decrypts encrypted data
 * @param  {String} data    The encrypted data to be decrypted
 * @return {String|Boolean} The decrypted data or false, if invalid data
 */
exports.decrypt = function(data) {
    if(typeof data !== 'string') return false;

    var decipher = crypto.createDecipher(algorithm,encryptionKey),
        dec = decipher.update(data,'hex','utf8');

    return dec+= decipher.final('utf8');
};
