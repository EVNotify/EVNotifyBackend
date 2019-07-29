const chai = require('chai');
const sinon = require('sinon');
const sandbox = sinon.createSandbox();

const db = require('../../../modules/db');
const uut = require('../../../modules/notification/mail');
const encryption = require('./../../../modules/encryption')

const srv_errors = require('./../../../srv_errors.json');

const doQuery = require('util').promisify(db.query);

chai.use(require('chai-as-promised'));
chai.use(require('chai-datetime'));
chai.should();

const clearAll = () => {
    return Promise.all(['sync', 'statistics', 'settings', 'qr', 'notificationMail', 'mailLock', 'logs', 'login', 'devices', 'debug'].map(e => doQuery('DELETE FROM ' + e))).then(() => doQuery('DELETE FROM accounts'));
}

const realSend = uut.simpleSend;

describe('mail', () => {
    beforeEach('clear db', clearAll);

    describe('checkMailUnlocked', () => {
        it('successful when table is empty', () => {
            return uut.checkMailUnlocked('test@example.com')
        });

        it('successful on unknown mail', () => {
            return doQuery('INSERT INTO mailLock(hash,time) VALUES(UNHEX(SHA2("someOtherMail@example.com",256)),TIMESTAMPADD(DAY, 1, CURRENT_TIMESTAMP()))').then(() => uut.checkMailUnlocked('test@example.com'));
        });

        it('successful on expired lock', () => {
            return doQuery('INSERT INTO mailLock(hash,time) VALUES(UNHEX(SHA2("test@example.com",256)),TIMESTAMPADD(DAY, -1, CURRENT_TIMESTAMP()))').then(() => uut.checkMailUnlocked('test@example.com'));
        });

        it('fail on active lock', () => {
            return doQuery('INSERT INTO mailLock(hash,time) VALUES(UNHEX(SHA2("test@example.com",256)),TIMESTAMPADD(DAY, 1, CURRENT_TIMESTAMP()))').then(() => uut.checkMailUnlocked('test@example.com')).should.eventually.be.rejectedWith(Error, /Recipient is currently locked/);
        });

    });

    describe('updateMailLock', () => {
        it('successful when table is empty', () => {
            return uut.updateMailLock('test@example.com').then(() => doQuery('SELECT HEX(hash),time,weight FROM mailLock ORDER BY hash')).then(queryRes => {
                const dateRange = createDates(0);
                queryRes.should.have.lengthOf(1);
                queryRes[0].should.have.property('weight', 1);
                queryRes[0].should.have.property('time').withinTime(dateRange[0], dateRange[1])
            })
        });

        it('successful on unknown mail', () => {
            return doQuery('INSERT INTO mailLock(hash,time) VALUES(UNHEX(SHA2("someOtherMail@example.com",256)),TIMESTAMPADD(DAY, 1, CURRENT_TIMESTAMP()))').then(() => uut.updateMailLock('test@example.com')).then(() => doQuery('SELECT HEX(hash) as hash,time,weight FROM mailLock ORDER BY hash')).then(queryRes => {
                const dateRangeOld = createDates(1440);
                const dateRangeNew = createDates(0);
                queryRes.should.have.lengthOf(2);

                queryRes[0].should.have.property('hash', '973DFE463EC85785F5F95AF5BA3906EEDB2D931C24E69824A89EA65DBA4E813B');
                queryRes[0].should.have.property('weight', 1);
                queryRes[0].should.have.property('time').withinTime(dateRangeNew[0], dateRangeNew[1])

                queryRes[1].should.have.property('hash', 'A88AC22920CAC00341069D6BD52EAA778187E3AE9109AB2FB1B593024B48F19A');
                queryRes[1].should.have.property('weight', 1);
                queryRes[1].should.have.property('time').withinTime(dateRangeOld[0], dateRangeOld[1])
            })
        });

        it('successful on known mail', () => {
            return doQuery('INSERT INTO mailLock(hash,time) VALUES(UNHEX(SHA2("test@example.com",256)), CURRENT_TIMESTAMP())').then(() => uut.updateMailLock('test@example.com')).then(() => doQuery('SELECT HEX(hash) as hash,time,weight FROM mailLock ORDER BY hash')).then(queryRes => {
                const dateRangeNew = createDates(4);
                queryRes.should.have.lengthOf(1);

                queryRes[0].should.have.property('hash', '973DFE463EC85785F5F95AF5BA3906EEDB2D931C24E69824A89EA65DBA4E813B');
                queryRes[0].should.have.property('weight', 2);
                queryRes[0].should.have.property('time').withinTime(dateRangeNew[0], dateRangeNew[1])
            })
        });

        it('successful on known heavy mail', () => {
            return doQuery('INSERT INTO mailLock(hash,time,weight) VALUES(UNHEX(SHA2("test@example.com",256)), TIMESTAMPADD(DAY, 1, CURRENT_TIMESTAMP()), 19)').then(() => uut.updateMailLock('test@example.com')).then(() => doQuery('SELECT HEX(hash) as hash,time,weight FROM mailLock ORDER BY hash')).then(queryRes => {
                const dateRangeNew = createDates(400);
                queryRes.should.have.lengthOf(1);

                queryRes[0].should.have.property('hash', '973DFE463EC85785F5F95AF5BA3906EEDB2D931C24E69824A89EA65DBA4E813B');
                queryRes[0].should.have.property('weight', 20);
                queryRes[0].should.have.property('time').withinTime(dateRangeNew[0], dateRangeNew[1])
            })
        });
    });

    describe('set mail', () => {
        promisedSetMail = require('util').promisify(uut.setMail);
        beforeEach(() => doQuery('INSERT INTO accounts VALUES(123456,1,2,3),(234567,4,5,6)'));
        beforeEach(() => sandbox.spy(uut, 'updateMailLock'));

        it('fails if new mail is same as current mail', () => {
            sandbox.stub(uut, 'simpleSend').callsFake((mail, subject, html, attachments, callback) => callback(false));
            return doQuery('INSERT INTO notificationMail(akey, mail, verified, identifier) VALUES(123456,?, TRUE, UNHEX("1234567890abcdef1234567890abcdef"))', [encryption.encrypt('test@example.com')])
                .then(() => promisedSetMail({ akey: '123456', lng: 'en' }, 'test@example.com').should.eventually.be.rejected.and.equal(srv_errors.CURRENT_MAIL));
        });

        it('new mail added successfully', () => {
            sandbox.stub(uut, 'simpleSend').callsFake((mail, subject, html, attachments, callback) => callback(false));
            return promisedSetMail({ akey: '123456', lng: 'en' }, 'test@example.com')
                .then(() => doQuery('SELECT akey,mail,verified FROM notificationMail'))
                .then(queryRes => {
                    queryRes.should.have.lengthOf(1);

                    queryRes[0].should.have.property('akey', '123456');
                    queryRes[0].should.have.property('mail');
                    encryption.decrypt(queryRes[0].mail).should.equal('test@example.com');
                    queryRes[0].should.have.property('verified', 0);

                    sinon.assert.calledWith(uut.updateMailLock, 'test@example.com');
                });
        });

        it('mail replaced successfully', () => {
            sandbox.stub(uut, 'simpleSend').callsFake((mail, subject, html, attachments, callback) => callback(false));
            return doQuery('INSERT INTO notificationMail(akey,mail,verified,identifier) VALUES(?,?,false,?)', [123456, encryption.encrypt('oldtest@example.com'), 'asd'])
                .then(() => promisedSetMail({ akey: '123456', lng: 'en' }, 'test@example.com'))
                .then(() => doQuery('SELECT akey,mail,verified FROM notificationMail'))
                .then(queryRes => {
                    queryRes.should.have.lengthOf(1);

                    queryRes[0].should.have.property('akey', '123456');
                    queryRes[0].should.have.property('mail');
                    encryption.decrypt(queryRes[0].mail).should.equal('test@example.com');
                    queryRes[0].should.have.property('verified', 0);

                    sinon.assert.calledWith(uut.updateMailLock, 'test@example.com');
                });
        });

        it('fails if invalid mail', () => {
            sandbox.stub(uut, 'simpleSend').callsFake((mail, subject, html, attachments, callback) => callback(false));
            return promisedSetMail({ akey: '123456', lng: 'en' }, 'test@@@example.com').should.eventually.be.rejected.and.equal(srv_errors.INVALID_PARAMETERS);
        });

        it('fails if sending of mail failed', () => {
            sandbox.stub(uut, 'simpleSend').callsFake((mail, subject, html, attachments, callback) => callback(new Error('some error...')));
            return promisedSetMail({ akey: '123456', lng: 'en' }, 'test@example.com').should.eventually.be.rejectedWith(Error, /some error.../);
        });

        it('fails if mail currently locked', () => {
            sandbox.stub(uut, 'simpleSend').callsFake((mail, subject, html, attachments, callback) => callback(false));
            sandbox.stub(uut, 'checkMailUnlocked').callsFake(() => Promise.reject(new Error('Recipient is currently locked')))
            return promisedSetMail({ akey: '123456', lng: 'en' }, 'test@example.com').should.eventually.be.rejectedWith(Error, /Recipient is currently locked/)
        });

        it('removes mail if not specified', () => {
            return doQuery('INSERT INTO notificationMail(akey,mail,verified,identifier) VALUES(?,?,false,?)', [123456, encryption.encrypt('test@example.com'), 'asd'])
                .then(() => promisedSetMail({ akey: '123456', lng: 'en' }, null))
                .then(() => doQuery('SELECT akey,mail,verified FROM notificationMail'))
                .then(queryRes => {
                    queryRes.should.have.lengthOf(0);
                });
        });

        afterEach(() => sandbox.restore())
    });

    describe('verify mail', () => {
        beforeEach(() => doQuery('INSERT INTO accounts VALUES(123456,1,2,3),(234567,4,5,6)')
            .then(() => doQuery('INSERT INTO notificationMail(akey, mail, verified, identifier) VALUES(123456,?, FALSE, UNHEX("1234567890abcdef1234567890abcdef")),(234567,?, TRUE, UNHEX("fedcba0987654321fedcba0987654321"))', ['test@example.com', 'test2@example.com'])));
        var promisedMailVerification = require('util').promisify(uut.verifyMail);

        it('verification of unverified mail successful', () => {
            return promisedMailVerification('1234567890abcdef1234567890abcdef');
        })

        it('verification of verified mail fails', () => {
            return promisedMailVerification('fedcba0987654321fedcba0987654321').should.eventually.be.rejected.and.equal(srv_errors.CONFLICT);
        })

        it('verification of unknown mail fails', () => {
            return promisedMailVerification('eeeeee0987654321fedcba0987654321').should.eventually.be.rejected.and.equal(srv_errors.NOT_FOUND);
        })
    })

    after(() => uut.simpleSend = realSend);
});

function createDates(minutesToAdd) {
    const endDateMin = new Date();
    endDateMin.setMinutes(endDateMin.getMinutes() + minutesToAdd - 1);
    const endDateMax = new Date();
    endDateMax.setMinutes(endDateMax.getMinutes() + minutesToAdd + 1);
    return [endDateMin, endDateMax];
}