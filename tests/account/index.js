/**
 * @file tests/account/index.js
 * @author GPlay97
 * @description Test for account module
 */
const chai = require('chai');
const chaiHttp = require('chai-http');
const srv_config = require('./../../srv_config.json');
const srv_errors = require('./../../srv_errors.json');
const isHTTPS = !srv_config.DEBUG && srv_config.CHAIN_PATH && srv_config.PRIVATE_KEY_PATH && srv_config.CERTIFICATE_PATH;
const RESTURL = ((isHTTPS) ? 'https' : 'http')+ '://127.0.0.1:' + srv_config.PORT;
const should = chai.should();

// init chai
chai.use(chaiHttp);

describe('getKey request', () => {
    let randomAKey;
    let randomAKey2;
    let token;

    it('Request new AKey', done => {
        chai.request(RESTURL).get('/key').end((err, res) => {
            should.not.exist(err);
            should.exist(res);
            res.should.have.status(200);
            res.should.be.json;
            res.should.have.property('body');
            res.body.should.be.an('object');
            res.body.should.not.have.property('error');
            res.body.should.have.property('akey').to.have.a.lengthOf(6);
            randomAKey = res.body.akey;
            done();
        });
    });

    it('Request second AKey to ensure contingency', done => {
        chai.request(RESTURL).get('/key').end((err, res) => {
            should.not.exist(err);
            should.exist(res);
            res.should.have.status(200);
            res.should.be.json;
            res.should.have.property('body');
            res.body.should.be.an('object');
            res.body.should.not.have.property('error');
            res.body.should.have.property('akey').to.have.a.lengthOf(6).to.not.eql(randomAKey);
            randomAKey2 = res.body.akey;
            done();
        });
    });

    it('Register account with missing parameters', done => {
        chai.request(RESTURL).post('/register').end((err, res) => {
            should.not.exist(err);
            should.exist(res);
            res.should.have.status(400);
            res.should.be.json;
            res.should.have.property('body');
            res.body.should.be.an('object');
            res.body.should.have.property('error');
            res.body.error.should.eql(srv_errors.INVALID_PARAMETERS);
            done();
        });
    });

    it('Register account with invalid AKey', done => {
        chai.request(RESTURL).post('/register').send({
            akey: 'invalid',
            password: 'password'
        }).end((err, res) => {
            should.not.exist(err);
            should.exist(res);
            res.should.have.status(400);
            res.should.be.json;
            res.should.have.property('body');
            res.body.should.be.an('object');
            res.body.should.have.property('error');
            res.body.error.should.eql(srv_errors.MALFORMED_AKEY);
            done();
        });
    });

    it('Register account with invalid password', done => {
        chai.request(RESTURL).post('/register').send({
            akey: randomAKey,
            password: 'short'
        }).end((err, res) => {
            should.not.exist(err);
            should.exist(res);
            res.should.have.status(400);
            res.should.be.json;
            res.should.have.property('body');
            res.body.should.be.an('object');
            res.body.should.have.property('error');
            res.body.error.should.eql(srv_errors.MALFORMED_PASSWORD);
            done();
        });
    });

    it('Register account with valid parameters', done => {
        chai.request(RESTURL).post('/register').send({
            akey: randomAKey,
            password: 'password'
        }).end((err, res) => {
            should.not.exist(err);
            should.exist(res);
            res.should.have.status(200);
            res.should.be.json;
            res.should.have.property('body');
            res.body.should.be.an('object');
            res.body.should.not.have.property('error');
            res.body.should.have.property('token').to.be.a('string').to.have.lengthOf(20);
            token = res.body.token;
            done();
        });
    });

    it('Register same account to ensure that no double registration is possible', done => {
        chai.request(RESTURL).post('/register').send({
            akey: randomAKey,
            password: 'password'
        }).end((err, res) => {
            should.not.exist(err);
            should.exist(res);
            res.should.have.status(422);
            res.should.be.json;
            res.should.have.property('body');
            res.body.should.be.an('object');
            res.body.should.have.property('error');
            res.body.error.should.eql(srv_errors.ALREADY_REGISTERED);
            done();
        });
    });

    it('Login account with missing parameters', done => {
        chai.request(RESTURL).post('/login').end((err, res) => {
            should.not.exist(err);
            should.exist(res);
            res.should.have.status(400);
            res.should.be.json;
            res.should.have.property('body');
            res.body.should.be.an('object');
            res.body.should.have.property('error');
            res.body.error.should.eql(srv_errors.INVALID_PARAMETERS);
            done();
        });
    });

    it('Login account with invalid AKey', done => {
        chai.request(RESTURL).post('/login').send({
            akey: 'invalid',
            password: 'password'
        }).end((err, res) => {
            should.not.exist(err);
            should.exist(res);
            res.should.have.status(400);
            res.should.be.json;
            res.should.have.property('body');
            res.body.should.be.an('object');
            res.body.should.have.property('error');
            res.body.error.should.eql(srv_errors.MALFORMED_AKEY);
            done();
        });
    });

    it('Login account with invalid password', done => {
        chai.request(RESTURL).post('/login').send({
            akey: randomAKey,
            password: 'short'
        }).end((err, res) => {
            should.not.exist(err);
            should.exist(res);
            res.should.have.status(400);
            res.should.be.json;
            res.should.have.property('body');
            res.body.should.be.an('object');
            res.body.should.have.property('error');
            res.body.error.should.eql(srv_errors.MALFORMED_PASSWORD);
            done();
        });
    });

    it('Login account with wrong password', done => {
        chai.request(RESTURL).post('/login').send({
            akey: randomAKey,
            password: 'password2'
        }).end((err, res) => {
            should.not.exist(err);
            should.exist(res);
            res.should.have.status(401);
            res.should.be.json;
            res.should.have.property('body');
            res.body.should.be.an('object');
            res.body.should.have.property('error');
            res.body.error.should.eql(srv_errors.INVALID_CREDENTIALS);
            done();
        });
    });

    it('Login account with unknown AKey', done => {
        chai.request(RESTURL).post('/login').send({
            akey: randomAKey2,
            password: 'password'
        }).end((err, res) => {
            should.not.exist(err);
            should.exist(res);
            res.should.have.status(404);
            res.should.be.json;
            res.should.have.property('body');
            res.body.should.be.an('object');
            res.body.should.have.property('error');
            res.body.error.should.eql(srv_errors.USER_NOT_EXISTING);
            done();
        });
    });

    it('Login account with valid parameters', done => {
        chai.request(RESTURL).post('/login').send({
            akey: randomAKey,
            password: 'password'
        }).end((err, res) => {
            should.not.exist(err);
            should.exist(res);
            res.should.have.status(200);
            res.should.be.json;
            res.should.have.property('body');
            res.body.should.be.an('object');
            res.body.should.not.have.property('error');
            res.body.should.have.property('token').to.be.a('string').to.have.lengthOf(20).to.eql(token);
            done();
        });
    });

    it('Change password of account with missing parameters', done => {
        chai.request(RESTURL).post('/changepw').end((err, res) => {
            should.not.exist(err);
            should.exist(res);
            res.should.have.status(400);
            res.should.be.json;
            res.should.have.property('body');
            res.body.should.be.an('object');
            res.body.should.have.property('error');
            res.body.error.should.eql(srv_errors.INVALID_PARAMETERS);
            done();
        });
    });

    it('Change password of account with invalid new password length', done => {
        chai.request(RESTURL).post('/changepw').send({
            akey: randomAKey,
            oldpassword: 'password',
            token: token,
            newpassword: 'short'
        }).end((err, res) => {
            should.not.exist(err);
            should.exist(res);
            res.should.have.status(400);
            res.should.be.json;
            res.should.have.property('body');
            res.body.should.be.an('object');
            res.body.should.have.property('error');
            res.body.error.should.eql(srv_errors.INVALID_PARAMETERS);
            done();
        });
    });

    it('Change password of account with valid new password but invalid token', done => {
        chai.request(RESTURL).post('/changepw').send({
            akey: randomAKey,
            oldpassword: 'password',
            token: 'invalid',
            newpassword: 'password2'
        }).end((err, res) => {
            should.not.exist(err);
            should.exist(res);
            res.should.have.status(401);
            res.should.be.json;
            res.should.have.property('body');
            res.body.should.be.an('object');
            res.body.should.have.property('error');
            res.body.error.should.eql(srv_errors.INVALID_TOKEN);
            done();
        });
    });

    it('Change password of account with valid new password but wrong old password', done => {
        chai.request(RESTURL).post('/changepw').send({
            akey: randomAKey,
            oldpassword: 'password3',
            token: token,
            newpassword: 'password2'
        }).end((err, res) => {
            should.not.exist(err);
            should.exist(res);
            res.should.have.status(401);
            res.should.be.json;
            res.should.have.property('body');
            res.body.should.be.an('object');
            res.body.should.have.property('error');
            res.body.error.should.eql(srv_errors.INVALID_CREDENTIALS);
            done();
        });
    });

    it('Change password of account with valid parameters', done => {
        chai.request(RESTURL).post('/changepw').send({
            akey: randomAKey,
            oldpassword: 'password',
            token: token,
            newpassword: 'password2'
        }).end((err, res) => {
            should.not.exist(err);
            should.exist(res);
            res.should.have.status(200);
            res.should.be.json;
            res.should.have.property('body');
            res.body.should.be.an('object');
            res.body.should.not.have.property('error');
            res.body.should.have.property('changed').to.be.true;
            done();
        });
    });

    it('Login account with old password should fail', done => {
        chai.request(RESTURL).post('/login').send({
            akey: randomAKey,
            password: 'password'
        }).end((err, res) => {
            should.not.exist(err);
            should.exist(res);
            res.should.have.status(401);
            res.should.be.json;
            res.should.have.property('body');
            res.body.should.be.an('object');
            res.body.should.have.property('error');
            res.body.error.should.eql(srv_errors.INVALID_CREDENTIALS);
            done();
        });
    });

    it('Login account with new password', done => {
        chai.request(RESTURL).post('/login').send({
            akey: randomAKey,
            password: 'password2'
        }).end((err, res) => {
            should.not.exist(err);
            should.exist(res);
            res.should.have.status(200);
            res.should.be.json;
            res.should.have.property('body');
            res.body.should.be.an('object');
            res.body.should.not.have.property('error');
            res.body.should.have.property('token').to.be.a('string').to.have.lengthOf(20).to.eql(token);
            done();
        });
    });
});
