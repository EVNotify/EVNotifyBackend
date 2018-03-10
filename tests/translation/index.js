var chai = require('chai'),
    should = chai.should(),
    translation = require('./../../translation/'),
    helper = require('./../../helper'),
    de = require('./../../translation/lng/de.json'),
    en = require('./../../translation/lng/en.json'),
    nl = require('./../../translation/lng/nl.json');

/**
 * test to validate the completeness of all translations
 */
describe('test completeness of all translations', function() {
    /**
     * Checks existence and validness of the different languages
     * @param  {Function} done  callback function which will be called after successfull execution
     * @return {void}
     */
    it('test existence of languages', function(done) {
        de.should.be.an('object');
        en.should.be.an('object');
        nl.should.be.an('object');
        done();
    });

    /**
     * Checks whether all languages are exactly the same
     * @param  {Function} done    callback function which will be called after successfull execution
     * @return {void}
     */
    it('test equality of languages', function(done) {
        should.equal(Object.keys(de).length, Object.keys(en).length);
        should.equal(Object.keys(en).length, Object.keys(nl).length);
        should.equal(Object.keys(de).every(key => en.hasOwnProperty(key)), true);
        should.equal(Object.keys(de).every(key => nl.hasOwnProperty(key)), true);
        done();
    });
});

/**
 * test to validate correct behavior on translate with invalid params
 */
describe('test translation with invalid params', function() {
    /**
     * Translation with no params
     * @param  {Function} done    callback function which will be called after successfull execution
     * @return {void}
     */
    it('translate with no params', function(done) {
        should.equal(translation.translate(), undefined);
        done();
    });

    /**
     * Translation with text, but no given language
     * @param  {Function} done    callback function which will be called after successfull execution
     * @return {void}
     */
    it('translate with no given language', function(done) {
        should.equal(translation.translate('TELEGRAM_SOC'), 'TELEGRAM_SOC');
        done();
    });

    /**
     * Translation with text, but invalid given language
     * @param  {Function} done    callback function which will be called after successfull execution
     * @return {void}
     */
    it('translate with non existing / invalid language', function(done) {
        should.equal(translation.translate('TELEGRAM_SOC', 'invalid'), 'TELEGRAM_SOC');
        done();
    });

    /**
     * Translation with text, invalid language, but english fallback enabled
     * @param  {Function} done    callback function which will be called after successfull execution
     * @return {void}
     */
    it('translate with invalid language, but with english fallback enabled', function(done) {
        should.equal(translation.translate('TELEGRAM_SOC', 'invalid', true), en.TELEGRAM_SOC);
        done();
    });
});

/**
 * test the german translation for validity
 */
describe('test german translation', function() {
    /**
     * Validates that all translations within german translation aren't empty
     * @param  {Function} done    callback function which will be called after successfull execution
     * @return {void}
     */
    it('test for completed strings', function(done) {
        should.equal(Object.keys(de).every(key => de[key].length), true);
        done();
    });

    /**
     * Validates that all translations within german translation return the expected translation
     * @param  {Function} done    callback function which will be called after successfull execution
     * @return {void}
     */
    it('test every translation', function(done) {
        should.equal(Object.keys(de).every(key => translation.translate(key, 'de') === de[key]), true);
        done();
    });
});

/**
 * test the english translation for validity
 */
describe('test englisch translation', function() {
    /**
     * Validates that all translations within english translation aren't empty
     * @param  {Function} done    callback function which will be called after successfull execution
     * @return {void}
     */
    it('test for completed strings', function(done) {
        should.equal(Object.keys(en).every(key => en[key].length), true);
        done();
    });

    /**
     * Validates that all translations within english translation return the expected translation
     * @param  {Function} done    callback function which will be called after successfull execution
     * @return {void}
     */
    it('test every translation', function(done) {
        should.equal(Object.keys(en).every(key => translation.translate(key, 'en') === en[key]), true);
        done();
    });
});

/**
 * test the dutch translation for validity
 */
describe('test dutch translation', function() {
    /**
     * Validates that all translations within dutch translation aren't empty
     * @param  {Function} done    callback function which will be called after successfull execution
     * @return {void}
     */
    it('test for completed strings', function(done) {
        should.equal(Object.keys(nl).every(key => nl[key].length), true);
        done();
    });

    /**
     * Validates that all translations within dutch translation return the expected translation
     * @param  {Function} done    callback function which will be called after successfull execution
     * @return {void}
     */
    it('test every translation', function(done) {
        should.equal(Object.keys(nl).every(key => translation.translate(key, 'nl') === nl[key]), true);
        done();
    });
});

var curTime = parseInt(new Date().getTime() / 1000),
    replacedTelegramSoc = 'The latest state of charge for your electric car is 12%. This will take you about 25km / 215km. Last stand: ' + helper.unixToTimeString(curTime);

describe('translateWithData replaces placeholders in string', function () {
    it('string without placeholder is unchanged', function(done) {
        should.equal(translation.translateWithData('EVNOTIFY_MAIL_SUBJECT', 'en', {EVNotify:"failed"}, false), en.EVNOTIFY_MAIL_SUBJECT);
        done();
    });

    it('data is inserted into string with placeholder', function(done) {
        should.equal(translation.translateWithData('TELEGRAM_SOC', 'en', {
            SOC: '12', RANGE: helper.calculateEstimatedRange(12), TIME: helper.unixToTimeString(curTime)}, false), replacedTelegramSoc);
        done();
    });

    it('string with placeholder is unchanged without matching data', function(done) {
        should.equal(translation.translateWithData('TELEGRAM_SOC', 'en', {
            SOC2: '12', RANGE2: helper.calculateEstimatedRange(12), TIME2: helper.unixToTimeString(curTime)}, false), en.TELEGRAM_SOC);
        done();
    });

    it('string without placeholder is unchanged on fallback', function(done) {
        should.equal(translation.translateWithData('EVNOTIFY_MAIL_SUBJECT', 'unknown', {EVNotify:"failed"}, true), en.EVNOTIFY_MAIL_SUBJECT);
        done();
    });

    it('data is inserted into string with placeholder on fallback', function(done) {
        should.equal(translation.translateWithData('TELEGRAM_SOC', 'unknown', {
            SOC: '12', RANGE: helper.calculateEstimatedRange(12), TIME: helper.unixToTimeString(curTime)}, true), replacedTelegramSoc);
        done();
    });

    it('string with placeholder is unchanged without matching on Fallback', function(done) {
        should.equal(translation.translateWithData('TELEGRAM_SOC', 'unknown', {
            SOC2: '12', RANGE2: helper.calculateEstimatedRange(12), TIME2: helper.unixToTimeString(curTime)}, true), en.TELEGRAM_SOC);
        done();
    });
});
