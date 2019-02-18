/**
 * @file modules/encryption/index.js
 * @author GPlay97
 * @description Module to encrypt and decrypt data
 */
const crypto = require('crypto'),
    srv_config = require('./../../srv_config.json');

module.exports = {
    /**
     * Encrypts data
     * @param {String} data the data to encrypt
     * @returns {String} the encrypted data
     */
    encrypt: (data) => {
        if (typeof data !== 'string' || !data.length) return false;

        let iv = crypto.randomBytes(16),
            cipher = crypto.createCipheriv('aes-256-ctr', srv_config.ENCRYPTION_KEY, iv),
            encrypted = cipher.update(data);

        return iv.toString('hex') + ':' + Buffer.concat([encrypted, cipher.final()]).toString('hex');
    },
    /**
     * Decrypts data
     * @param {String} data the data to decrypt
     * @returns {String} the decrypted data
     */
    decrypt: (data) => {
        if (typeof data !== 'string' || !data.length) return false;

        let parts = data.split(':'),
            decipher = crypto.createDecipheriv('aes-256-ctr', srv_config.ENCRYPTION_KEY, new Buffer(parts.shift(), 'hex')),
            decrypted = decipher.update(new Buffer(parts.join(':'), 'hex'));

        return Buffer.concat([decrypted, decipher.final()]).toString();
    }
};