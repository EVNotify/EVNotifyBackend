var chai = require('chai'),
    should = chai.should(),
    encryption = require('./../../encryption'),
    encrypted;

/**
 * test to validate that encryption is working
 */
describe('test encryption', function() {
    /**
     * Encrypting without any data to ensure that no invalid data types can be encrypted and lead to errors
     * @param  {Function} done  callback function which will be called after successfull execution
     * @return {void}
     */
    it('test encryption with no data', function(done) {
        should.equal(encryption.encrypt(), false);
        done();
    });

    /**
     * Encrypt a string and store it to compare it later
     * @param  {Function} done  callback function which will be called after successfull execution
     * @return {void}
     */
    it('test encryption with valid string', function(done) {
        encrypted = encryption.encrypt('TEST');
        encrypted.should.be.a('string');
        should.not.equal(encrypted, 'TEST');
        done();
    });

    /**
     * Encrypt the same string again and check if encrypted string equals with previous one
     * @param  {Function} done  callback function which will be called after successfull execution
     * @return {void}
     */
    it('test encryption with same valid string', function(done) {
        should.equal(encryption.encrypt('TEST'), encrypted);
        done();
    });

    /**
     * Decrypting without any data to ensure that no invalid data types can be decrypted and lead to errors
     * @param  {Function} done  callback function which will be called after successfull execution
     * @return {void}
     */
    it('test decryption with no data', function(done) {
        should.equal(encryption.decrypt(), false);
        done();
    });

    /**
     * Decrypts previously encrypted string and check if it equals the plain text string again
     * @param  {Function} done  callback function which will be called after successfull execution
     * @return {void}
     */
    it('test decryption to retrieve original string again', function(done) {
        should.equal(encryption.decrypt(encrypted), 'TEST');
        done();
    });
});
