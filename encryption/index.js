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
    if(typeof data !== 'string' || !data.length) return false;

    var iv = crypto.randomBytes(16),
        cipher = crypto.createCipheriv(algorithm, encryptionKey, iv),
        encrypted = cipher.update(data);

    return iv.toString('hex') + ':' + Buffer.concat([encrypted, cipher.final()]).toString('hex');
};

/**
 * Function which decrypts encrypted data
 * @param  {String} data    The encrypted data to be decrypted
 * @return {String|Boolean} The decrypted data or false, if invalid data
 */
exports.decrypt = function(data) {
    if(typeof data !== 'string' || !data.length) return false;

    var parts = data.split(':'),
        decipher = crypto.createDecipheriv(algorithm, encryptionKey, new Buffer(parts.shift(), 'hex')),
        decrypted = decipher.update(new Buffer(parts.join(':'),'hex'));

    return Buffer.concat([decrypted, decipher.final()]).toString();
};
