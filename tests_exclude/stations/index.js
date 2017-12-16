var chai = require('chai'),
    chaiHttp = require('chai-http'),
    srv_config = require('./../../srv_config.json'),
    RESTURL = 'http://127.0.0.1:' + srv_config.PORT + '/',
    should = chai.should(),
    demoStation;

// init chai
chai.use(chaiHttp);

/**
 * test for getStations request
 */
describe('getStations request', function() {
    /**
     * getStations request with missing parameters
     * @param  {Function} done  callback function which will be called after successfull execution
     * @return {void}
     */
    it('getStations with missing parameters', function(done) {
        chai.request(RESTURL).post('getstations').end(function(err, res) {
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
     * getStations request with valid location
     * @param  {Function} done  callback function which will be called after successfull execution
     * @return {void}
     */
    it('getStations for valid location', function(done) {
        this.timeout(10000);    // increase timeout for slow stations API requests
        chai.request(RESTURL).post('getstations').set('content-type', 'application/json').send({lat: 50, lng: 8}).end(function(err, res) {
            should.not.exist(err);
            should.exist(res);
            res.should.have.status(200);
            res.should.be.json;
            res.should.have.property('body');
            res.body.should.be.an('object');
            res.body.should.have.property('err').to.be.null;   // NOTE: in the stations module error peroperty is err and null value in case of no error
            res.body.should.have.property('stations');
            res.body.stations.should.be.an('object');
            res.body.stations.should.have.property('status').equal('ok');
            res.body.stations.should.have.property('chargelocations');
            res.body.stations.chargelocations.should.be.an('array');
            res.body.stations.chargelocations.length.should.be.at.least(1);
            should.equal(res.body.stations.chargelocations.every(station => station.ge_id), true);
            demoStation = res.body.stations.chargelocations[0].ge_id;
            done();
        });
    });
});

/**
 * test for getStation request
 */
describe('gestStation request', function() {
    /**
     * getStation request with missing parameters
     * @param  {Function} done  callback function which will be called after successfull execution
     * @return {void}
     */
    it('getStation with missing parameters', function(done) {
        chai.request(RESTURL).post('getstation').end(function(err, res) {
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
     * getStation request for demo station
     * @param  {Function} done  callback function which will be called after successfull execution
     * @return {void}
     */
    it('getStation for demo station', function(done) {
        this.timeout(10000);    // increase timeout for slow stations API requests
        chai.request(RESTURL).post('getstation').set('content-type', 'application/json').send({id: demoStation}).end(function(err, res) {
            should.not.exist(err);
            should.exist(res);
            res.should.have.status(200);
            res.should.be.json;
            res.should.have.property('body');
            res.body.should.be.an('object');
            res.body.should.have.property('err').to.be.null;   // NOTE: in the stations module error peroperty is err and null value in case of no error
            res.body.should.have.property('station');
            res.body.station.should.be.an('object');
            res.body.station.should.have.property('status').equal('ok');
            res.body.station.should.have.property('chargelocations');
            res.body.station.chargelocations.should.be.an('array');
            res.body.station.chargelocations.length.should.equal(1);
            res.body.station.chargelocations[0].should.be.an('object');
            res.body.station.chargelocations[0].should.have.property('ge_id');
            done();
        });
    });
});

// NOTE: We do not test the photo stream - currently there is some trouble decoding the binary response - but beside that
// huge amount of data will be transferred and requested from the API, which should not be used within multiple tests.

/**
 * test for getStationCards request
 */
describe('getStationCards request', function() {
    /**
     * getStationCards request for demo station
     * @param  {Function} done  callback function which will be called after successfull execution
     * @return {void}
     */
    it('getStationCards', function(done) {
        this.timeout(10000);    // increase timeout for slow stations API requests
        chai.request(RESTURL).post('getstationcards').end(function(err, res) {
            should.not.exist(err);
            should.exist(res);
            res.should.have.status(200);
            res.should.be.json;
            res.should.have.property('body');
            res.body.should.be.an('object');
            res.body.should.have.property('err').to.be.null;   // NOTE: in the stations module error peroperty is err and null value in case of no error
            res.body.should.have.property('cards');
            res.body.cards.should.be.an('object');
            res.body.cards.should.have.property('status').equal('ok');
            res.body.cards.should.have.property('result');
            res.body.cards.result.should.be.an('array');
            res.body.cards.result.length.should.be.at.least(1);
            should.equal(res.body.cards.result.every(card => card.card_id), true);
            done();
        });
    });
});
