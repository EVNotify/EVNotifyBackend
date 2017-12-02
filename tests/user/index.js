var chai = require('chai'),
    chaiHttp = require('chai-http'),
    srv_config = require('./../../srv_config.json'),
    RESTURL = 'http://127.0.0.1:' + srv_config.PORT + '/',
    should = chai.should(),
    registeredAkey = false,
    unRegisteredAkey = false,
    registeredToken = false,
    newRegisteredToken = false,
    optionObj = {
        email: 'EMAIL',
        telegram: 1234,
        soc: 50,
        curSoC: 20,
        device: 'DEVICE',
        polling: 2,
        autoSync: 0,
        lng: 'LNG',
        push: 1
    },
    syncObj = optionObj;

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
 * test for changePW request
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

/**
 * test for setSettings request
 */
describe('setSettings request', function() {
    /**
     * setSettings with missing parameters
     * @param  {Function} done  callback function which will be called after successfull execution
     * @return {void}
     */
    it('setSettings with missing parameters', function(done) {
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
     * setSettings with missing option object
     * @param  {Function} done  callback function which will be called after successfull execution
     * @return {void}
     */
    it('setSettings with missing option object', function(done) {
        chai.request(RESTURL).post('settings').set('content-type', 'application/json').send({
            akey: registeredAkey, token: registeredToken, password: 'SYSTEMTEST2', option: 'SET'
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
     * setSettings with wrong credentials
     * @param  {Function} done  callback function which will be called after successfull execution
     * @return {void}
     */
    it('setSettings with invalid credentials', function(done) {
        chai.request(RESTURL).post('settings').set('content-type', 'application/json').send({
            akey: registeredAkey, token: registeredToken, password: 'SYSTEMTEST', option: 'SET', optionObj: optionObj
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
     * setSettings with valid credentials, but with an invalid token
     * @param  {Function} done  callback function which will be called after successfull execution
     * @return {void}
     */
    it('setSettings with invalid token', function(done) {
        chai.request(RESTURL).post('settings').set('content-type', 'application/json').send({
            akey: registeredAkey, token: 'INVALID', password: 'SYSTEMTEST2', option: 'SET', optionObj: optionObj
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
     * setSettings with valid credentials and token, but invalid option
     * @param  {Function} done  callback function which will be called after successfull execution
     * @return {void}
     */
    it('setSettings with invalid option', function(done) {
        chai.request(RESTURL).post('settings').set('content-type', 'application/json').send({
            akey: registeredAkey, token: registeredToken, password: 'SYSTEMTEST2', option: 'INVALID', optionObj: optionObj
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
     * setSettings with valid credentials, token and optionObj to apply new settings
     * @param  {Function} done  callback function which will be called after successfull execution
     * @return {void}
     */
    it('setSettings with valid credentials and option to apply new settings', function(done) {
        chai.request(RESTURL).post('settings').set('content-type', 'application/json').send({
            akey: registeredAkey, token: registeredToken, password: 'SYSTEMTEST2', option: 'SET', optionObj: optionObj
        }).end(function(err, res) {
            should.not.exist(err);
            should.exist(res);
            res.should.have.status(200);
            res.should.be.json;
            res.should.have.property('body');
            res.body.should.be.an('object');
            res.body.should.not.have.property('error');
            res.body.should.have.property('message').equal('Set settings succeeded');
            done();
        });
    });

    /**
     * getSettings to validate previous applied settings to be stored successfully within database
     * @param  {Function} done  callback function which will be called after successfull execution
     * @return {void}
     */
    it('getSettings to validate stored new settings', function(done) {
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
            res.body.settings.should.have.property('email').equal(optionObj.email);
            res.body.settings.should.have.property('telegram').equal(optionObj.telegram);
            res.body.settings.should.have.property('soc').equal(optionObj.soc);
            res.body.settings.should.have.property('curSoC').equal(optionObj.curSoC);
            res.body.settings.should.have.property('device').equal(optionObj.device);
            res.body.settings.should.have.property('polling').equal(optionObj.polling);
            res.body.settings.should.have.property('autoSync').equal(optionObj.autoSync);
            res.body.settings.should.have.property('lng').equal(optionObj.lng);
            res.body.settings.should.have.property('push').equal(optionObj.push);
            done();
        });
    });
});

/**
 * test for renewToken request
 */
describe('renewToken request', function() {
    /**
     * renewToken with missing parameters
     * @param  {Function} done  callback function which will be called after successfull execution
     * @return {void}
     */
    it('renewToken with missing parameters', function(done) {
        chai.request(RESTURL).post('renewtoken').end(function(err, res) {
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
     * renewToken with wrong credentials
     * @param  {Function} done  callback function which will be called after successfull execution
     * @return {void}
     */
    it('renewToken with invalid credentials', function(done) {
        chai.request(RESTURL).post('renewtoken').set('content-type', 'application/json').send({
            akey: registeredAkey, password: 'SYSTEMTEST'
        }).end(function(err, res) {
            should.exist(err);
            should.exist(res);
            res.should.have.status(409);
            res.should.be.json;
            res.should.have.property('body');
            res.body.should.be.an('object');
            res.body.should.have.property('error').equal('invalid credentials');
            res.body.should.have.property('message').equal('Token renewal failed');
            done();
        });
    });

    /**
     * renewToken and save new token
     * @param  {Function} done  callback function which will be called after successfull execution
     * @return {void}
     */
    it('renewToken, save and compare', function(done) {
        chai.request(RESTURL).post('renewtoken').set('content-type', 'application/json').send({
            akey: registeredAkey, password: 'SYSTEMTEST2'
        }).end(function(err, res) {
            should.not.exist(err);
            should.exist(res);
            res.should.have.status(200);
            res.should.be.json;
            res.should.have.property('body');
            res.body.should.be.an('object');
            res.body.should.not.have.property('error');
            res.body.should.have.property('message').equal('Token renewed');
            res.body.should.have.property('token').not.equal(registeredToken);
            newRegisteredToken = res.body.token;
            done();
        });
    });

    /**
     * getSettings with old, now invalid, token
     * @param  {Function} done  callback function which will be called after successfull execution
     * @return {void}
     */
    it('getSettings with old token', function(done) {
        chai.request(RESTURL).post('settings').set('content-type', 'application/json').send({
            akey: registeredAkey, token: registeredToken, password: 'SYSTEMTEST2', option: 'GET'
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
     * getSettings with new token
     * @param  {Function} done  callback function which will be called after successfull execution
     * @return {void}
     */
    it('getSettings with new token', function(done) {
        chai.request(RESTURL).post('settings').set('content-type', 'application/json').send({
            akey: registeredAkey, token: newRegisteredToken, password: 'SYSTEMTEST2', option: 'GET'
        }).end(function(err, res) {
            should.not.exist(err);
            should.exist(res);
            res.should.have.status(200);
            res.should.be.json;
            res.should.have.property('body');
            res.body.should.be.an('object');
            res.body.should.have.property('message').equal('Get settings succeeded');
            res.body.should.have.property('settings');
            res.body.settings.should.be.an('object');
            done();
        });
    });
});

/**
 * test for sync request
 */
describe('sync request', function() {
    /**
     * sync with missing parameters
     * @param  {Function} done  callback function which will be called after successfull execution
     * @return {void}
     */
    it('sync with missing parameters', function(done) {
        chai.request(RESTURL).post('sync').end(function(err, res) {
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
     * sync with wrong sync mode type
     * @param  {Function} done  callback function which will be called after successfull execution
     * @return {void}
     */
    it('sync with wrong type', function(done) {
        chai.request(RESTURL).post('sync').set('content-type', 'application/json').send({
            akey: registeredAkey, token: newRegisteredToken, type: 'INVALID'
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
     * sync with mode PUSH, but missing sync object
     * @param  {Function} done  callback function which will be called after successfull execution
     * @return {void}
     */
    it('sync (push mode) with missing syncObj', function(done) {
        chai.request(RESTURL).post('sync').set('content-type', 'application/json').send({
            akey: registeredAkey, token: newRegisteredToken, type: 'INVALID'
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
     * sync with mode PUSH, but autoSync disabled for user
     * @param  {Function} done  callback function which will be called after successfull execution
     * @return {void}
     */
    it('sync (push mode) with sync disabled', function(done) {
        chai.request(RESTURL).post('sync').set('content-type', 'application/json').send({
            akey: registeredAkey, token: newRegisteredToken, type: 'PUSH', syncObj: syncObj
        }).end(function(err, res) {
            should.exist(err);
            should.exist(res);
            res.should.have.status(409);
            res.should.be.json;
            res.should.have.property('body');
            res.body.should.be.an('object');
            res.body.should.have.property('error').to.be.null;
            res.body.should.have.property('message').equal('Sync not enabled');
            done();
        });
    });

    /**
     * enables autoSync option
     * @param  {Function} done  callback function which will be called after successfull execution
     * @return {void}
     */
    it('enable autoSync', function(done) {
        optionObj.autoSync = 10;
        chai.request(RESTURL).post('settings').set('content-type', 'application/json').send({
            akey: registeredAkey, token: newRegisteredToken, password: 'SYSTEMTEST2', option: 'SET', optionObj: optionObj
        }).end(function(err, res) {
            should.not.exist(err);
            should.exist(res);
            res.should.have.status(200);
            res.should.be.json;
            res.should.have.property('body');
            res.body.should.be.an('object');
            res.body.should.not.have.property('error');
            res.body.should.have.property('message').equal('Set settings succeeded');
            done();
        });
    });

    /**
     * sync with mode PUSH, autoSync enabled and a sync object
     * @param  {Function} done  callback function which will be called after successfull execution
     * @return {void}
     */
    it('sync (push mode) with sync enabled and syncObj', function(done) {
        syncObj.email = 'NEW_EMAIL';
        syncObj.telegram = 4321;
        syncObj.soc = 55;
        syncObj.curSoC = 22;
        syncObj.device = 'NEW_DEVICE';
        syncObj.polling = 4;
        syncObj.autoSync = 0;
        syncObj.lng = 'NEW_LNG';
        syncObj.push = 0;
        chai.request(RESTURL).post('sync').set('content-type', 'application/json').send({
            akey: registeredAkey, token: newRegisteredToken, type: 'PUSH', syncObj: syncObj
        }).end(function(err, res) {
            should.not.exist(err);
            should.exist(res);
            res.should.have.status(200);
            res.should.be.json;
            res.should.have.property('body');
            res.body.should.be.an('object');
            res.body.should.not.have.property('error');
            res.body.should.have.property('message').equal('Push for sync succeeded');
            res.body.should.have.property('syncRes').to.be.true;
            done();
        });
    });

    /**
     * Checks if synced settings are successfully stored within database
     * @param  {Function} done  callback function which will be called after successfull execution
     * @return {void}
     */
    it('compare settings with synced settings', function(done) {
        chai.request(RESTURL).post('settings').set('content-type', 'application/json').send({
            akey: registeredAkey, token: newRegisteredToken, password: 'SYSTEMTEST2', option: 'GET'
        }).end(function(err, res) {
            should.not.exist(err);
            should.exist(res);
            res.should.have.status(200);
            res.should.be.json;
            res.should.have.property('body');
            res.body.should.be.an('object');
            res.body.should.have.property('message').equal('Get settings succeeded');
            res.body.should.have.property('settings');
            res.body.settings.should.be.an('object');
            res.body.settings.should.have.property('email').equal(syncObj.email);
            res.body.settings.should.have.property('telegram').equal(syncObj.telegram);
            res.body.settings.should.have.property('soc').equal(syncObj.soc);
            res.body.settings.should.have.property('curSoC').equal(syncObj.curSoC);
            res.body.settings.should.have.property('device').equal(syncObj.device);
            res.body.settings.should.have.property('polling').equal(syncObj.polling);
            res.body.settings.should.have.property('autoSync').equal(syncObj.autoSync);
            res.body.settings.should.have.property('lng').equal(syncObj.lng);
            res.body.settings.should.have.property('push').equal(syncObj.push);
            done();
        });
    });

    /**
     * sync with mode PULL, but autoSync disabled
     * @param  {Function} done  callback function which will be called after successfull execution
     * @return {void}
     */
    it('sync (pull mode) with sync disabled', function(done) {
        chai.request(RESTURL).post('sync').set('content-type', 'application/json').send({
            akey: registeredAkey, token: newRegisteredToken, type: 'PULL'
        }).end(function(err, res) {
            should.exist(err);
            should.exist(res);
            res.should.have.status(409);
            res.should.be.json;
            res.should.have.property('body');
            res.body.should.be.an('object');
            res.body.should.have.property('error').to.be.null;
            res.body.should.have.property('message').equal('Sync not enabled');
            done();
        });
    });

    /**
     * enables autoSync option
     * @param  {Function} done  callback function which will be called after successfull execution
     * @return {void}
     */
    it('enable autoSync', function(done) {
        syncObj.autoSync = 10;
        chai.request(RESTURL).post('settings').set('content-type', 'application/json').send({
            akey: registeredAkey, token: newRegisteredToken, password: 'SYSTEMTEST2', option: 'SET', optionObj: syncObj
        }).end(function(err, res) {
            should.not.exist(err);
            should.exist(res);
            res.should.have.status(200);
            res.should.be.json;
            res.should.have.property('body');
            res.body.should.be.an('object');
            res.body.should.not.have.property('error');
            res.body.should.have.property('message').equal('Set settings succeeded');
            done();
        });
    });

    /**
     * sync with mode PULL and autoSync enabled
     * @param  {Function} done  callback function which will be called after successfull execution
     * @return {void}
     */
    it('sync (pull mode) with sync enabled', function(done) {
        chai.request(RESTURL).post('sync').set('content-type', 'application/json').send({
            akey: registeredAkey, token: newRegisteredToken, type: 'PULL'
        }).end(function(err, res) {
            should.not.exist(err);
            should.exist(res);
            res.should.have.status(200);
            res.should.be.json;
            res.should.have.property('body');
            res.body.should.be.an('object');
            res.body.should.not.have.property('error');
            res.body.should.have.property('message').equal('Pull for sync succeeded');
            res.body.should.have.property('syncRes');
            res.body.syncRes.should.be.an('object');
            res.body.syncRes.should.have.property('email').equal(syncObj.email);
            res.body.syncRes.should.have.property('telegram').equal(syncObj.telegram);
            res.body.syncRes.should.have.property('soc').equal(syncObj.soc);
            res.body.syncRes.should.have.property('curSoC').equal(syncObj.curSoC);
            res.body.syncRes.should.have.property('device').equal(syncObj.device);
            res.body.syncRes.should.have.property('polling').equal(syncObj.polling);
            res.body.syncRes.should.have.property('autoSync').equal(syncObj.autoSync);
            res.body.syncRes.should.have.property('lng').equal(syncObj.lng);
            res.body.syncRes.should.have.property('push').equal(syncObj.push);
            done();
        });
    });
});
