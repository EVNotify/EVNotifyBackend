var chai = require('chai'),
    chaiHttp = require('chai-http'),
    srv_config = require('./../../srv_config.json'),
    RESTURL = 'http://127.0.0.1:' + srv_config.PORT + '/',
    should = chai.should(),
    registeredAkey = false,
    unRegisteredAkey = false,
    registeredToken = false;

// init chai
chai.use(chaiHttp);

/**
 * test for getKey request
 */
describe('getKey request', function() {
    var akey1,
        akey2;

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
            akey1 = registeredAkey = res.body.akey;
            done();
        });
    });

    /**
     * Requests generation of a new, unused key and checks if previous key doesn't equal to ensure uniqueness
     * @param  {Function} done  callback function which will be called after successfull execution
     * @return {void}
     */
    it('generate other key', function(done) {
        chai.request(RESTURL).post('getkey').end(function(err, res) {
            should.not.exist(err);
            should.exist(res);
            res.should.have.status(200);
            res.should.be.json;
            res.should.have.property('body');
            res.body.should.be.an('object');
            res.body.should.not.have.property('error');
            res.body.should.have.property('akey');
            akey2 = unRegisteredAkey = res.body.akey;
            akey1.should.not.be.equal(akey2);
            done();
        });
    });
});

/**
 * test for register request
 */
describe('register request', function() {
    /**
     * Request register function with missing parameters
     * @param  {Function} done  callback function which will be called after successfull execution
     * @return {void}
     */
    it('register with missing parameters', function(done) {
        chai.request(RESTURL).post('register').end(function(err, res) {
            should.exist(err);
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

    /**
     * Re-register account which was registered before to ensure account uniqueness
     * @param  {Function} done  callback function which will be called after successfull execution
     * @return {void}
     */
    it('register already registered account', function(done) {
        chai.request(RESTURL).post('register').set('content-type', 'application/json').send({akey: registeredAkey, password: 'SYSTEMTEST'}).end(function(err, res) {
            should.exist(err);
            should.exist(res);
            res.should.have.status(409);
            res.should.be.json;
            res.should.have.property('body');
            res.body.should.be.an('object');
            res.body.should.have.property('error').equal('account already registered');
            res.body.should.have.property('message').equal('Registration failed');
            done();
        });
    });
});

/**
 * test for login request
 */
describe('login request', function() {
    /**
     * Login request with missing parameters
     * @param  {Function} done  callback function which will be called after successfull execution
     * @return {void}
     */
    it('login with missing parameters', function(done) {
        chai.request(RESTURL).post('login').end(function(err, res) {
            should.exist(err);
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
     * Login with invalid account (not-existing)
     * @param  {Function} done  callback function which will be called after successfull execution
     * @return {void}
     */
    it('login with non-existing account', function(done) {
        chai.request(RESTURL).post('login').set('content-type', 'application/json').send({akey: unRegisteredAkey, password: 'SYSTEMTEST'}).end(function(err, res) {
            should.exist(err);
            should.exist(res);
            res.should.have.status(409);
            res.should.be.json;
            res.should.have.property('body');
            res.body.should.be.an('object');
            res.body.should.have.property('error').equal('account does not exist');
            res.body.should.have.property('message').equal('Login failed');
            done();
        });
    });

    /**
     * Login with invalid credentials (wrong password)
     * @param  {Function} done  callback function which will be called after successfull execution
     * @return {void}
     */
    it('login with invalid credentials', function(done) {
        chai.request(RESTURL).post('login').set('content-type', 'application/json').send({akey: registeredAkey, password: 'INVALID'}).end(function(err, res) {
            should.exist(err);
            should.exist(res);
            res.should.have.status(409);
            res.should.be.json;
            res.should.have.property('body');
            res.body.should.be.an('object');
            res.body.should.have.property('error').equal('invalid credentials');
            res.body.should.have.property('message').equal('Login failed');
            done();
        });
    });

    /**
     * Login with valid credentials to retrieve the token we can use for further requests
     * @param  {Function} done  callback function which will be called after successfull execution
     * @return {void}
     */
    it('login with valid credentials', function(done) {
        chai.request(RESTURL).post('login').set('content-type', 'application/json').send({akey: registeredAkey, password: 'SYSTEMTEST'}).end(function(err, res) {
            should.not.exist(err);
            should.exist(res);
            res.should.have.status(200);
            res.should.be.json;
            res.should.have.property('body');
            res.body.should.be.an('object');
            res.body.should.not.have.property('error');
            res.body.should.have.property('message').equal('Login successfull');
            res.body.should.have.property('token').equal(registeredToken);
            done();
        });
    });
});

/**
 * test for password change request
 */
describe('password change request', function() {
    /**
     * Password change request with missing parameters
     * @param  {Function} done  callback function which will be called after successfull execution
     * @return {void}
     */
    it('password change with missing parameters', function(done) {
        chai.request(RESTURL).post('changePW').end(function(err, res) {
            should.exist(err);
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
     * Password change request for non-existing account
     * @param  {Function} done  callback function which will be called after successfull execution
     * @return {void}
     */
    it('password change for non-existing account', function(done) {
        chai.request(RESTURL).post('changePW').set('content-type', 'application/json').send({
            akey: unRegisteredAkey, token: 'SOMETOKEN', password: 'SYSTEMTEST', newpassword: 'SYSTEMTEST2'
        }).end(function(err, res) {
            should.exist(err);
            should.exist(res);
            res.should.have.status(409);
            res.should.be.json;
            res.should.have.property('body');
            res.body.should.be.an('object');
            res.body.should.have.property('error').equal('account does not exist');
            res.body.should.have.property('message').equal('Password change failed');
            done();
        });
    });

    /**
     * Password change with valid akey, but invalid token
     * @param  {Function} done  callback function which will be called after successfull execution
     * @return {void}
     */
    it('password change with invalid token', function(done) {
        chai.request(RESTURL).post('changePW').set('content-type', 'application/json').send({
            akey: registeredAkey, token: 'INVALID', password: 'SYSTEMTEST', newpassword: 'SYSTEMTEST2'
        }).end(function(err, res) {
            should.exist(err);
            should.exist(res);
            res.should.have.status(409);
            res.should.be.json;
            res.should.have.property('body');
            res.body.should.be.an('object');
            res.body.should.have.property('error').equal(401);
            res.body.should.have.property('message').equal('Password change failed');
            done();
        });
    });

    /**
     * Password change with valid akey and token, but invalid new password (too short)
     * @param  {Function} done  callback function which will be called after successfull execution
     * @return {void}
     */
    it('password change with invalid password', function(done) {
        chai.request(RESTURL).post('changePW').set('content-type', 'application/json').send({
            akey: registeredAkey, token: registeredToken, password: 'INVALID', newpassword: 'SYSTEMTEST2'
        }).end(function(err, res) {
            should.exist(err);
            should.exist(res);
            res.should.have.status(409);
            res.should.be.json;
            res.should.have.property('body');
            res.body.should.be.an('object');
            res.body.should.have.property('error').equal('invalid credentials');
            res.body.should.have.property('message').equal('Password change failed');
            done();
        });
    });

    /**
     * Password change with valid akey and token, but invalid new password (too short)
     * @param  {Function} done  callback function which will be called after successfull execution
     * @return {void}
     */
    it('password change with invalid new password', function(done) {
        chai.request(RESTURL).post('changePW').set('content-type', 'application/json').send({
            akey: registeredAkey, token: registeredToken, password: 'SYSTEMTEST', newpassword: 'new'
        }).end(function(err, res) {
            should.exist(err);
            should.exist(res);
            res.should.have.status(409);
            res.should.be.json;
            res.should.have.property('body');
            res.body.should.be.an('object');
            res.body.should.have.property('error').equal('The password must be at least 6 characters.');
            res.body.should.have.property('message').equal('Password change failed');
            done();
        });
    });

    /**
     * Password change with valid akey, token and new password which will be set
     * @param  {Function} done  callback function which will be called after successfull execution
     * @return {void}
     */
    it('password change with valid new password', function(done) {
        chai.request(RESTURL).post('changePW').set('content-type', 'application/json').send({
            akey: registeredAkey, token: registeredToken, password: 'SYSTEMTEST', newpassword: 'SYSTEMTEST2'
        }).end(function(err, res) {
            should.not.exist(err);
            should.exist(res);
            res.should.have.status(200);
            res.should.be.json;
            res.should.have.property('body');
            res.body.should.be.an('object');
            res.body.should.not.have.property('error');
            res.body.should.have.property('message').equal('Password change succeeded');
            done();
        });
    });

    /**
     * Login with old, now invalid, credentials
     * @param  {Function} done  callback function which will be called after successfull execution
     * @return {void}
     */
    it('login with old credentials', function(done) {
        chai.request(RESTURL).post('login').set('content-type', 'application/json').send({akey: registeredAkey, password: 'SYSTEMTEST'}).end(function(err, res) {
            should.exist(err);
            should.exist(res);
            res.should.have.status(409);
            res.should.be.json;
            res.should.have.property('body');
            res.body.should.be.an('object');
            res.body.should.have.property('error').equal('invalid credentials');
            res.body.should.have.property('message').equal('Login failed');
            done();
        });
    });

    /**
     * Login with new, now valid, credentials
     * @param  {Function} done  callback function which will be called after successfull execution
     * @return {void}
     */
    it('login with new credentials', function(done) {
        chai.request(RESTURL).post('login').set('content-type', 'application/json').send({akey: registeredAkey, password: 'SYSTEMTEST2'}).end(function(err, res) {
            should.not.exist(err);
            should.exist(res);
            res.should.have.status(200);
            res.should.be.json;
            res.should.have.property('body');
            res.body.should.be.an('object');
            res.body.should.not.have.property('error');
            res.body.should.have.property('message').equal('Login successfull');
            res.body.should.have.property('token').equal(registeredToken);
            done();
        });
    });
});

/**
 * test for getSettings request
 */
describe('getSettings request', function() {
    /**
     * getSettings with missing parameters
     * @param  {Function} done  callback function which will be called after successfull execution
     * @return {void}
     */
    it('getSettings with missing parameters', function(done) {
        chai.request(RESTURL).post('settings').end(function(err, res) {
            should.exist(err);
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
     * getSettings with wrong credentials
     * @param  {Function} done  callback function which will be called after successfull execution
     * @return {void}
     */
    it('getSettings with invalid credentials', function(done) {
        chai.request(RESTURL).post('settings').set('content-type', 'application/json').send({
            akey: registeredAkey, token: registeredToken, password: 'SYSTEMTEST', option: 'GET'
        }).end(function(err, res) {
            should.exist(err);
            should.exist(res);
            res.should.have.status(409);
            res.should.be.json;
            res.should.have.property('body');
            res.body.should.be.an('object');
            res.body.should.have.property('error').equal('invalid credentials');
            res.body.should.have.property('message').equal('Login failed');
            done();
        });
    });

    /**
     * getSettings with valid credentials, but with an invalid token
     * @param  {Function} done  callback function which will be called after successfull execution
     * @return {void}
     */
    it('getSettings with invalid token', function(done) {
        chai.request(RESTURL).post('settings').set('content-type', 'application/json').send({
            akey: registeredAkey, token: 'INVALID', password: 'SYSTEMTEST2', option: 'GET'
        }).end(function(err, res) {
            should.exist(err);
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
     * getSettings with valid credentials and token, but invalid option
     * @param  {Function} done  callback function which will be called after successfull execution
     * @return {void}
     */
    it('getSettings with invalid option', function(done) {
        chai.request(RESTURL).post('settings').set('content-type', 'application/json').send({
            akey: registeredAkey, token: registeredToken, password: 'SYSTEMTEST2', option: 'INVALID'
        }).end(function(err, res) {
            should.exist(err);
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
     * getSettings with valid credentials, token and option to check if all required properties will be transmitted
     * @param  {Function} done  callback function which will be called after successfull execution
     * @return {void}
     */
    it('getSettings with valid credentials and option', function(done) {
        chai.request(RESTURL).post('settings').set('content-type', 'application/json').send({
            akey: registeredAkey, token: registeredToken, password: 'SYSTEMTEST2', option: 'GET'
        }).end(function(err, res) {
            should.not.exist(err);
            should.exist(res);
            res.should.have.status(200);
            res.should.be.json;
            res.should.have.property('body');
            res.body.should.be.an('object');
            res.body.should.not.have.property('error');
            res.body.should.have.property('message').equal('Get settings succeeded');
            res.body.should.have.property('settings');
            res.body.settings.should.be.an('object');
            res.body.settings.should.have.property('email');
            res.body.settings.should.have.property('telegram');
            res.body.settings.should.have.property('soc');
            res.body.settings.should.have.property('curSoC');
            res.body.settings.should.have.property('device');
            res.body.settings.should.have.property('polling');
            res.body.settings.should.have.property('autoSync');
            res.body.settings.should.have.property('lng');
            res.body.settings.should.have.property('push');
            done();
        });
    });
});
