var chai = require('chai'),
    chaiHttp = require('chai-http'),
    srv_config = require('./../../srv_config.json'),
    RESTURL = 'http://127.0.0.1:' + srv_config.PORT + '/',
    should = chai.should(),
    registeredAkey,
    registeredToken;

// init chai
chai.use(chaiHttp);

/**
 * Prepare notification testing
 * NOTE: This will create a new account to test whether notification routing and handling is correct.
 *      This will not(!) test the notification function itself!
 */
describe('prepare notification testing', function() {
    /**
     * Requests generation of a new, unused key and checks it
     * @param  {Function} done  callback function which will be called after successfull execution
     * @return {void}
     */
    it('generate new key', function(done) {
        chai.request(RESTURL).post('getkey').end(function(err, res) {
            should.not.exist(err);
            should.exist(res);
            res.should.have.status(200);
            res.should.be.json;
            res.should.have.property('body');
            res.body.should.be.an('object');
            res.body.should.not.have.property('error');
            res.body.should.have.property('akey');
            registeredAkey = res.body.akey;
            done();
        });
    });

    /**
     * Registers a new account with previous random generated akey to retrieve token
     * @param  {Function} done  callback function which will be called after successfull execution
     * @return {void}
     */
    it('register new account', function(done) {
        chai.request(RESTURL).post('register').set('content-type', 'application/json').send({akey: registeredAkey, password: 'SYSTEMTEST'}).end(function(err, res) {
            should.not.exist(err);
            should.exist(res);
            res.should.have.status(200);
            res.should.be.json;
            res.should.have.property('body');
            res.body.should.be.an('object');
            res.body.should.not.have.property('error');
            res.body.should.have.property('message').equal('Registration successfull');
            res.body.should.have.property('token');
            registeredToken = res.body.token;
            done();
        });
    });
});

/**
 * test notification processing
 * NOTE: This only tests the behaviour and routing of notification handling.
 *       It will not(!) test the functionality because all functions
 *       will be processed in the background, based on it's services.
 *       Testing of the notification requires manual testing!
 *       Furthermore every Telegram function requires manual testing!
 */
describe('test notification handling', function() {
    /**
     * Sends notification request with missing parameters
     * @param  {Function} done  callback function which will be called after successfull execution
     * @return {void}
     */
    it('send notification with missing parameters', function(done) {
        chai.request(RESTURL).post('notification').end(function(err, res) {
            should.not.exist(err);
            should.exist(res);
            res.should.have.status(422);
            res.should.be.json;
            res.should.have.property('body');
            res.body.should.be.an('object');
            res.body.should.have.property('error').equal(422);
            res.body.should.have.property('message').equal('Missing parameters. Unable to handle request');
            done();
        });
    });

    /**
     * Sends notification request with invalid / non-existing account
     * @param  {Function} done  callback function which will be called after successfull execution
     * @return {void}
     */
    it('send notification with invalid account', function(done) {
        chai.request(RESTURL).post('notification').set('content-type', 'application/json').send({akey: 'INVALID', token: registeredToken}).end(function(err, res) {
            should.not.exist(err);
            should.exist(res);
            res.should.have.status(401);
            res.should.be.json;
            res.should.have.property('body');
            res.body.should.be.an('object');
            res.body.should.have.property('error').equal(401);
            res.body.should.have.property('message').equal('Unauthorized');
            done();
        });
    });

    /**
     * Sends notification request with valid account, but invalid token
     * @param  {Function} done  callback function which will be called after successfull execution
     * @return {void}
     */
    it('send notification with invalid token', function(done) {
        chai.request(RESTURL).post('notification').set('content-type', 'application/json').send({akey: registeredAkey, token: 'INVALID'}).end(function(err, res) {
            should.not.exist(err);
            should.exist(res);
            res.should.have.status(401);
            res.should.be.json;
            res.should.have.property('body');
            res.body.should.be.an('object');
            res.body.should.have.property('error').equal(401);
            res.body.should.have.property('message').equal('Unauthorized');
            done();
        });
    });

    /**
     * Sends notification request with valid account and valid token
     * @param  {Function} done  callback function which will be called after successfull execution
     * @return {void}
     */
    it('send notification with valid token', function(done) {
        chai.request(RESTURL).post('notification').set('content-type', 'application/json').send({akey: registeredAkey, token: registeredToken}).end(function(err, res) {
            should.not.exist(err);
            should.exist(res);
            res.should.have.status(200);
            res.should.be.json;
            res.should.have.property('body');
            res.body.should.be.an('object');
            res.body.should.not.have.property('error');
            res.body.should.have.property('message').equal('Notifications successfully sent');
            done();
        });
    });
});
