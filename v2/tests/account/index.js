/**
 * @file tests/account/index.js
 * @author GPlay97
 * @description Test for account module
 */
const chai = require('chai');
const chaiHttp = require('chai-http');
const srv_config = require('./../../srv_config.json');
const RESTURL = 'http://127.0.0.1:' + srv_config.PORT;
const should = chai.should();

// init chai
chai.use(chaiHttp);

describe('getKey request', () => {
    it('Request new AKey', done => {
        chai.request(RESTURL).get('/key').end((err, res) => {
            should.not.exist(err);
            should.exist(res);
            res.should.have.status(200);
            res.should.be.json;
            res.should.have.property('body');
            res.body.should.be.an('object');
            res.body.should.not.have.property('error');
            res.body.should.have.property('akey');
            done();
        });
    });
});